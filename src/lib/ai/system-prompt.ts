import type { BoardRole } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

type SnapshotInput = {
  boardId: string;
  user: { name?: string | null; email?: string | null };
  role: BoardRole;
};

/**
 * Системный промпт. Содержит роль, контекст пользователя, СТРУКТУРУ доски
 * (колонки + метки) — и жёсткие правила про ID и подтверждения.
 *
 * почему именно так: модель должна знать колонки и метки, чтобы не звать
 * list_columns/list_labels на каждый чих. Карточки НЕ включаем — их часто
 * много, лучше пусть зовёт list_cards с фильтром.
 */
export async function buildSystemPrompt(input: SnapshotInput): Promise<string> {
  const board = await prisma.board.findUnique({
    where: { id: input.boardId },
    select: {
      title: true,
      columns: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          _count: { select: { cards: { where: { archivedAt: null } } } },
        },
      },
      labels: {
        orderBy: { position: "asc" },
        select: { id: true, name: true, color: true },
      },
    },
  });
  if (!board) throw new Error("Board not found in buildSystemPrompt");

  const today = new Date().toISOString().slice(0, 10);
  const userName = input.user.name || input.user.email || "пользователь";

  const columnsBlock = board.columns
    .map((c) => `  - ${c.title} (id: ${c.id}, карточек: ${c._count.cards})`)
    .join("\n");
  const labelsBlock =
    board.labels.length > 0
      ? board.labels
          .map(
            (l) =>
              `  - "${l.name || "(без имени)"}" — цвет ${l.color}, id: ${l.id}`,
          )
          .join("\n")
      : "  (меток на доске нет)";

  return [
    "Ты — ассистент-помощник в Kanban-планировщике Pinna.",
    "Помогаешь пользователю управлять задачами на доске через инструменты.",
    "",
    `Сегодня: ${today}.`,
    `Пользователь: ${userName}, роль на доске: ${input.role}.`,
    `Доска: «${board.title}».`,
    "",
    "Колонки доски:",
    columnsBlock,
    "",
    "Метки доски:",
    labelsBlock,
    "",
    "ПРАВИЛА:",
    "- ОБЛАСТЬ: помогаешь только с задачами на этой доске. Если вопрос НЕ про доску, карточки, колонки, планирование, дедлайны или твои собственные возможности — коротко откажи: «Я помогаю только с задачами на доске. Спросите про карточки, колонки или планирование.» Без рассуждений, без длинных ответов, без выполнения off-topic запросов (общие знания, программирование, переводы, математика, личные вопросы и т.д.).",
    "- Не выдумывай ID. Если нужно найти карточку — сначала вызови list_cards с фильтром.",
    "- Для дат используй формат YYYY-MM-DD. 'Сегодня', 'завтра', 'на следующей неделе' считай через get_today_date.",
    "- Если пользователь говорит «сделай X в колонке Y» и колонки Y нет — спроси, не имел ли он в виду похожую.",
    "- Деструктивные операции (delete_card, delete_column) ВСЕГДА возвращают pending_confirmation. Не пытайся обойти. Если получил pending — кратко сообщи пользователю что подтверждение появилось в UI.",
    "- Для массовых операций используй несколько вызовов tool, по одной операции за раз. Лимит 10 итераций tool use.",
    "- Кратко рапортуй о результатах: «Создал карточку «X» в колонке «Y»» или «Перенёс 3 карточки в «Готово»».",
    "- Если у пользователя роль VIEWER — все мутирующие инструменты вернут «Недостаточно прав». Поясни ему это, не пытайся повторно.",
    "",
    "СТИЛЬ ОТВЕТА:",
    "- По-русски. Кратко, по делу. Без эмодзи. Без рекламных оборотов («с удовольствием», «отличный вопрос»).",
    "- Не повторяй то, что уже сказал tool в результате. Просто констатируй: что сделал и что осталось.",
  ].join("\n");
}
