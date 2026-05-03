"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { revalidateAndNotifyBoard } from "@/lib/realtime/notify";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import {
  ForbiddenError,
  NotFoundError,
  assertBoardAccess,
  canManageMembers,
} from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { sendBoardInvite } from "@/lib/email/resend";
import {
  actionError,
  actionOk,
  type ActionResult,
} from "@/types/action-result";
import type { BoardRole } from "@prisma/client";

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Неверный email"),
  role: z.enum(["MEMBER", "CONTRIBUTOR", "VIEWER"]),
});

const roleSchema = z.enum(["OWNER", "MEMBER", "CONTRIBUTOR", "VIEWER"]);

function fieldErrorsFromZod(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const p = issue.path.join(".");
    if (p && !out[p]) out[p] = issue.message;
  }
  return out;
}

function handle(err: unknown): ActionResult<never> {
  if (err instanceof NotFoundError) return actionError("Не найдено");
  if (err instanceof ForbiddenError) return actionError("Недостаточно прав");
  console.error("[member-actions]", err);
  return actionError("Не удалось выполнить действие");
}

export async function inviteToBoard(
  boardId: string,
  input: { email: string; role: BoardRole },
): Promise<ActionResult<{ url: string; emailSent: boolean }>> {
  try {
    const user = await requireUser();
    const role = await assertBoardAccess(user.id, boardId);
    if (!canManageMembers(role)) throw new ForbiddenError();

    const parsed = inviteSchema.safeParse(input);
    if (!parsed.success) {
      return actionError("Проверьте поля", fieldErrorsFromZod(parsed.error));
    }
    const { email, role: invitedRole } = parsed.data;

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true, title: true },
    });
    if (!board) throw new NotFoundError();

    // Уже участник?
    const existingMember = await prisma.boardMember.findFirst({
      where: { boardId, user: { email } },
      select: { id: true },
    });
    if (existingMember) {
      return actionError("Этот пользователь уже участник доски", {
        email: "Уже участник",
      });
    }

    // Если уже есть pending invite — обновим срок
    const existingInvite = await prisma.boardInvite.findFirst({
      where: { boardId, email, acceptedAt: null },
      select: { id: true, token: true },
    });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = existingInvite
      ? await prisma.boardInvite.update({
          where: { id: existingInvite.id },
          data: { expiresAt, role: invitedRole, invitedById: user.id },
          select: { token: true },
        })
      : await prisma.boardInvite.create({
          data: {
            boardId,
            email,
            role: invitedRole,
            token: randomUUID(),
            invitedById: user.id,
            expiresAt,
          },
          select: { token: true },
        });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
    const acceptUrl = `${baseUrl}/invite/${invite.token}`;

    const emailRes = await sendBoardInvite({
      to: email,
      boardTitle: board.title,
      inviterName: user.name || user.email || "Пользователь",
      acceptUrl,
    });

    await revalidateAndNotifyBoard(boardId);
    return actionOk({
      url: acceptUrl,
      emailSent: emailRes.ok && !emailRes.skipped,
    });
  } catch (e) {
    return handle(e);
  }
}

export async function revokeInvite(
  inviteId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const inv = await prisma.boardInvite.findUnique({
      where: { id: inviteId },
      select: { boardId: true },
    });
    if (!inv) throw new NotFoundError();
    const role = await assertBoardAccess(user.id, inv.boardId);
    if (!canManageMembers(role)) throw new ForbiddenError();
    await prisma.boardInvite.delete({ where: { id: inviteId } });
    await revalidateAndNotifyBoard(inv.boardId);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function acceptInvite(
  token: string,
): Promise<ActionResult<{ boardId: string }>> {
  try {
    const user = await requireUser();
    const invite = await prisma.boardInvite.findUnique({
      where: { token },
      select: {
        id: true,
        boardId: true,
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
      },
    });
    if (!invite) return actionError("Приглашение не найдено");
    if (invite.acceptedAt) return actionError("Приглашение уже принято");
    if (invite.expiresAt < new Date())
      return actionError("Срок приглашения истёк");

    // Проверяем, что email совпадает (или пропускаем — на усмотрение)
    if (
      user.email &&
      invite.email.toLowerCase() !== user.email.toLowerCase()
    ) {
      return actionError(
        `Приглашение для ${invite.email}, а вы вошли как ${user.email}.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.boardMember.upsert({
        where: {
          boardId_userId: { boardId: invite.boardId, userId: user.id },
        },
        create: {
          boardId: invite.boardId,
          userId: user.id,
          role: invite.role,
        },
        update: { role: invite.role },
      });
      await tx.boardInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
    });

    await logActivity({
      boardId: invite.boardId,
      userId: user.id,
      type: "MEMBER_JOINED",
      payload: { role: invite.role },
    });

    await revalidateAndNotifyBoard(invite.boardId);
    revalidatePath("/boards");
    return actionOk({ boardId: invite.boardId });
  } catch (e) {
    return handle(e);
  }
}

export async function changeMemberRole(
  boardId: string,
  userId: string,
  newRole: BoardRole,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const role = await assertBoardAccess(user.id, boardId);
    if (!canManageMembers(role)) throw new ForbiddenError();

    const parsed = roleSchema.safeParse(newRole);
    if (!parsed.success) return actionError("Некорректная роль");

    const target = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
      select: { role: true },
    });
    if (!target) throw new NotFoundError();

    // Если снимаем OWNER — проверим, что останется хотя бы один
    if (target.role === "OWNER" && parsed.data !== "OWNER") {
      const otherOwners = await prisma.boardMember.count({
        where: { boardId, role: "OWNER", NOT: { userId } },
      });
      if (otherOwners === 0) {
        return actionError("Нельзя снять последнего владельца");
      }
    }

    await prisma.boardMember.update({
      where: { boardId_userId: { boardId, userId } },
      data: { role: parsed.data },
    });
    await revalidateAndNotifyBoard(boardId);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function removeMember(
  boardId: string,
  userId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const role = await assertBoardAccess(user.id, boardId);
    if (!canManageMembers(role)) throw new ForbiddenError();

    const target = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId } },
      select: { role: true },
    });
    if (!target) throw new NotFoundError();

    if (target.role === "OWNER") {
      const otherOwners = await prisma.boardMember.count({
        where: { boardId, role: "OWNER", NOT: { userId } },
      });
      if (otherOwners === 0) {
        return actionError("Нельзя удалить последнего владельца");
      }
    }

    await prisma.boardMember.delete({
      where: { boardId_userId: { boardId, userId } },
    });
    await revalidateAndNotifyBoard(boardId);
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function leaveBoard(
  boardId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const member = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: user.id } },
      select: { role: true },
    });
    if (!member) throw new NotFoundError();

    if (member.role === "OWNER") {
      const otherOwners = await prisma.boardMember.count({
        where: { boardId, role: "OWNER", NOT: { userId: user.id } },
      });
      if (otherOwners === 0) {
        return actionError(
          "Сначала передайте права владельца другому участнику",
        );
      }
    }

    await prisma.boardMember.delete({
      where: { boardId_userId: { boardId, userId: user.id } },
    });
    revalidatePath("/boards");
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

/**
 * Список входящих приглашений для текущего пользователя.
 * Match по email (case-insensitive), только активные.
 */
export async function listMyPendingInvites() {
  const user = await requireUser();
  if (!user.email) return [];
  return prisma.boardInvite.findMany({
    where: {
      email: user.email.toLowerCase(),
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      role: true,
      createdAt: true,
      expiresAt: true,
      board: { select: { id: true, title: true, description: true } },
      invitedBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });
}

/** Отклонить приглашение, адресованное мне. */
export async function declineMyInvite(
  inviteId: string,
): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    const inv = await prisma.boardInvite.findUnique({
      where: { id: inviteId },
      select: { email: true, acceptedAt: true },
    });
    if (!inv) throw new NotFoundError();
    if (
      !user.email ||
      inv.email.toLowerCase() !== user.email.toLowerCase()
    ) {
      throw new ForbiddenError();
    }
    if (inv.acceptedAt) return actionError("Уже принято");
    await prisma.boardInvite.delete({ where: { id: inviteId } });
    revalidatePath("/account");
    revalidatePath("/boards");
    return actionOk(undefined);
  } catch (e) {
    return handle(e);
  }
}

export async function listBoardMembers(boardId: string) {
  const user = await requireUser();
  await assertBoardAccess(user.id, boardId);
  const [members, invites] = await Promise.all([
    prisma.boardMember.findMany({
      where: { boardId },
      orderBy: { joinedAt: "asc" },
      select: {
        role: true,
        joinedAt: true,
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    }),
    prisma.boardInvite.findMany({
      where: { boardId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true,
      },
    }),
  ]);
  return { members, invites };
}
