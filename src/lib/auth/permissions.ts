import { prisma } from "@/lib/db/prisma";
import type { BoardRole } from "@prisma/client";

// Иерархия ролей: чем ниже число — тем больше прав.
// почему числа: упрощает сравнение "роль X ≥ требуемой Y" одной операцией.
const ROLE_RANK: Record<BoardRole, number> = {
  OWNER: 0,
  MEMBER: 1,
  VIEWER: 2,
};

export class ForbiddenError extends Error {
  constructor(message = "Недостаточно прав") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Не найдено") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Проверяет, что пользователь имеет доступ к доске со ролью не ниже minRole.
 * Возвращает роль пользователя на доске. Кидает NotFoundError если доступа нет —
 * почему: чтобы не раскрывать существование чужой доски, имитируем 404.
 */
export async function assertBoardAccess(
  userId: string,
  boardId: string,
  minRole: BoardRole = "VIEWER",
): Promise<BoardRole> {
  const member = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
    select: { role: true },
  });
  if (!member) {
    throw new NotFoundError();
  }
  if (ROLE_RANK[member.role] > ROLE_RANK[minRole]) {
    throw new ForbiddenError();
  }
  return member.role;
}

export function canEditBoard(role: BoardRole) {
  return role === "OWNER";
}

export function canDeleteBoard(role: BoardRole) {
  return role === "OWNER";
}

export function canMutateContent(role: BoardRole) {
  // OWNER + MEMBER могут менять колонки/карточки; VIEWER только читает
  return role === "OWNER" || role === "MEMBER";
}

export function canManageMembers(role: BoardRole) {
  return role === "OWNER";
}

export function roleAtLeast(role: BoardRole, min: BoardRole) {
  return ROLE_RANK[role] <= ROLE_RANK[min];
}
