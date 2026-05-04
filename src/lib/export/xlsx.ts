import ExcelJS from "exceljs";
import { format } from "date-fns";

import type { BoardForExport } from "@/lib/export/data";

/**
 * Генерирует XLSX-буфер с экспортом доски. Один лист "Карточки" со всеми
 * карточками построчно (колонка/заголовок/метки/дедлайн/назначен/описание),
 * второй лист "Чек-листы" с разворотом по пунктам.
 */
export async function generateBoardXlsx(
  board: BoardForExport,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Pinna";
  wb.created = new Date();
  wb.title = board.title;

  // Лист 1: карточки построчно
  const sheet = wb.addWorksheet("Карточки");
  sheet.columns = [
    { header: "Колонка", key: "column", width: 20 },
    { header: "Заголовок", key: "title", width: 40 },
    { header: "Метки", key: "labels", width: 25 },
    { header: "Дедлайн", key: "due", width: 14 },
    { header: "Назначен", key: "assignee", width: 25 },
    { header: "Описание", key: "description", width: 60 },
    { header: "Комментарии", key: "commentsCount", width: 12 },
    { header: "Чек-листы", key: "checklistsProgress", width: 14 },
  ];
  // Жирный заголовок
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle" };

  for (const col of board.columns) {
    for (const card of col.cards) {
      const totalItems = card.checklists.reduce(
        (s, cl) => s + cl.items.length,
        0,
      );
      const doneItems = card.checklists.reduce(
        (s, cl) => s + cl.items.filter((i) => i.done).length,
        0,
      );
      sheet.addRow({
        column: col.title,
        title: card.title,
        labels: card.labels
          .map((cl) => cl.label.name || cl.label.color)
          .join(", "),
        due: card.dueDate ? format(card.dueDate, "yyyy-MM-dd") : "",
        assignee: card.assignee
          ? card.assignee.name || card.assignee.email
          : "",
        description: card.description ?? "",
        commentsCount: card.comments.length,
        checklistsProgress: totalItems > 0 ? `${doneItems}/${totalItems}` : "",
      });
    }
  }

  // Перенос текста для широких колонок
  sheet.getColumn("description").alignment = { wrapText: true, vertical: "top" };
  sheet.getColumn("title").alignment = { wrapText: true, vertical: "top" };

  // Лист 2: чек-листы построчно
  const checklistsSheet = wb.addWorksheet("Чек-листы");
  checklistsSheet.columns = [
    { header: "Колонка", key: "column", width: 20 },
    { header: "Карточка", key: "card", width: 35 },
    { header: "Чек-лист", key: "checklist", width: 25 },
    { header: "Пункт", key: "item", width: 50 },
    { header: "Готово", key: "done", width: 10 },
  ];
  checklistsSheet.getRow(1).font = { bold: true };

  for (const col of board.columns) {
    for (const card of col.cards) {
      for (const cl of card.checklists) {
        for (const it of cl.items) {
          checklistsSheet.addRow({
            column: col.title,
            card: card.title,
            checklist: cl.title,
            item: it.text,
            done: it.done ? "✓" : "",
          });
        }
      }
    }
  }

  // Лист 3: метки доски
  if (board.labels.length > 0) {
    const labelsSheet = wb.addWorksheet("Метки");
    labelsSheet.columns = [
      { header: "Имя", key: "name", width: 25 },
      { header: "Цвет", key: "color", width: 15 },
    ];
    labelsSheet.getRow(1).font = { bold: true };
    for (const l of board.labels) {
      labelsSheet.addRow({ name: l.name || "(без имени)", color: l.color });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
