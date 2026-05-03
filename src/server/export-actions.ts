"use server";

import { format } from "date-fns";
import { ru } from "date-fns/locale";

import { requireUser } from "@/lib/auth";
import { assertBoardAccess } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";

async function fetchBoardWithEverything(boardId: string) {
  return prisma.board.findUnique({
    where: { id: boardId },
    include: {
      labels: { orderBy: { position: "asc" } },
      columns: {
        orderBy: { position: "asc" },
        include: {
          cards: {
            where: { archivedAt: null },
            orderBy: { position: "asc" },
            include: {
              labels: { include: { label: true } },
              checklists: {
                orderBy: { position: "asc" },
                include: {
                  items: { orderBy: { position: "asc" } },
                },
              },
              comments: {
                orderBy: { createdAt: "asc" },
                include: {
                  author: { select: { name: true, email: true } },
                },
              },
              assignee: { select: { name: true, email: true } },
            },
          },
        },
      },
    },
  });
}

/**
 * JSON-экспорт доски целиком. Используется для бэкапов и переноса.
 */
export async function exportBoardJson(boardId: string): Promise<string> {
  const user = await requireUser();
  await assertBoardAccess(user.id, boardId);
  const board = await fetchBoardWithEverything(boardId);
  if (!board) throw new Error("Board not found");
  return JSON.stringify(board, null, 2);
}

/**
 * Markdown-экспорт. Читаемый людьми; колонки = H2, карточки списком.
 */
export async function exportBoardMarkdown(boardId: string): Promise<string> {
  const user = await requireUser();
  await assertBoardAccess(user.id, boardId);
  const board = await fetchBoardWithEverything(boardId);
  if (!board) throw new Error("Board not found");

  const out: string[] = [];
  out.push(`# ${board.title}`);
  out.push("");
  if (board.description) {
    out.push(board.description);
    out.push("");
  }
  out.push(
    `> Экспорт от ${format(new Date(), "d MMMM yyyy, HH:mm", { locale: ru })}`,
  );
  out.push("");

  if (board.labels.length > 0) {
    out.push("## Метки");
    out.push("");
    for (const l of board.labels) {
      out.push(`- **${l.name || "(без имени)"}** — \`${l.color}\``);
    }
    out.push("");
  }

  for (const col of board.columns) {
    out.push(`## ${col.title} (${col.cards.length})`);
    out.push("");
    if (col.cards.length === 0) {
      out.push("_пусто_");
      out.push("");
      continue;
    }
    for (const card of col.cards) {
      out.push(`### ${card.title}`);
      out.push("");
      const meta: string[] = [];
      if (card.dueDate) {
        meta.push(
          `📅 ${format(card.dueDate, "d MMM yyyy", { locale: ru })}`,
        );
      }
      if (card.assignee) {
        meta.push(
          `👤 ${card.assignee.name || card.assignee.email}`,
        );
      }
      if (card.labels.length > 0) {
        meta.push(
          `🏷 ${card.labels
            .map((cl) => cl.label.name || cl.label.color)
            .join(", ")}`,
        );
      }
      if (meta.length > 0) {
        out.push(meta.join(" · "));
        out.push("");
      }
      if (card.description) {
        out.push(card.description);
        out.push("");
      }
      for (const cl of card.checklists) {
        out.push(`**${cl.title}**`);
        for (const it of cl.items) {
          out.push(`- [${it.done ? "x" : " "}] ${it.text}`);
        }
        out.push("");
      }
      if (card.comments.length > 0) {
        out.push("_Комментарии:_");
        for (const c of card.comments) {
          const who = c.author?.name || c.author?.email || "Удалён";
          const when = format(c.createdAt, "d MMM HH:mm", { locale: ru });
          out.push(`- **${who}** (${when}): ${c.body.replace(/\n/g, " ")}`);
        }
        out.push("");
      }
    }
  }

  return out.join("\n");
}
