import path from "node:path";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import PDFDocument from "pdfkit";

import type { BoardForExport } from "@/lib/export/data";

// Roboto поддерживает кириллицу — без него pdfkit рисует пустые квадратики.
const FONT_REGULAR = path.join(
  process.cwd(),
  "public",
  "fonts",
  "Roboto-Regular.ttf",
);
const FONT_BOLD = path.join(
  process.cwd(),
  "public",
  "fonts",
  "Roboto-Bold.ttf",
);

/**
 * Генерирует PDF-буфер с экспортом доски. Один документ, A4, две колонки
 * метаданных, секции по колонкам, карточки с заголовком, метками, дедлайном,
 * описанием, чек-листами, комментариями.
 */
export async function generateBoardPdf(
  board: BoardForExport,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
      // Передаём наш шрифт сразу в конструкторе. Без этого pdfkit пытается
      // загрузить встроенный Helvetica.afm, путь к которому ломается webpack'ом
      // в Next.js (получается /ROOT/node_modules/... — буквально).
      font: FONT_REGULAR,
      info: {
        Title: board.title,
        Producer: "Pinna",
        Creator: "Pinna",
      },
    });

    doc.registerFont("Regular", FONT_REGULAR);
    doc.registerFont("Bold", FONT_BOLD);
    doc.font("Regular");

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Шапка
    doc.font("Bold").fontSize(24).text(board.title);
    doc.moveDown(0.3);
    if (board.description) {
      doc.font("Regular").fontSize(11).fillColor("#444").text(board.description);
      doc.moveDown(0.3);
    }
    doc
      .font("Regular")
      .fontSize(9)
      .fillColor("#888")
      .text(
        `Экспорт от ${format(new Date(), "d MMMM yyyy, HH:mm", { locale: ru })}`,
      );
    doc.moveDown(1);
    doc.fillColor("#000");

    // Метки доски
    if (board.labels.length > 0) {
      doc.font("Bold").fontSize(13).text("Метки");
      doc.moveDown(0.3);
      doc.font("Regular").fontSize(10);
      for (const l of board.labels) {
        doc.text(`• ${l.name || "(без имени)"}  [${l.color}]`);
      }
      doc.moveDown(0.8);
    }

    // Колонки
    for (const col of board.columns) {
      // Лёгкий разрыв страницы перед каждой колонкой если осталось мало места
      if (doc.y > doc.page.height - 200) doc.addPage();

      doc
        .font("Bold")
        .fontSize(16)
        .fillColor("#000")
        .text(`${col.title}`, { continued: true })
        .font("Regular")
        .fontSize(11)
        .fillColor("#888")
        .text(`   (${col.cards.length})`);
      doc.moveDown(0.4);
      doc.fillColor("#000");

      if (col.cards.length === 0) {
        doc.font("Regular").fontSize(10).fillColor("#888").text("пусто");
        doc.moveDown(0.6);
        doc.fillColor("#000");
        continue;
      }

      for (const card of col.cards) {
        if (doc.y > doc.page.height - 120) doc.addPage();

        doc.font("Bold").fontSize(12).text(card.title);
        doc.moveDown(0.2);

        const meta: string[] = [];
        if (card.dueDate) {
          meta.push(
            `Дедлайн: ${format(card.dueDate, "d MMM yyyy", { locale: ru })}`,
          );
        }
        if (card.assignee) {
          meta.push(`Назначен: ${card.assignee.name || card.assignee.email}`);
        }
        if (card.labels.length > 0) {
          meta.push(
            `Метки: ${card.labels
              .map((cl) => cl.label.name || cl.label.color)
              .join(", ")}`,
          );
        }
        if (meta.length > 0) {
          doc
            .font("Regular")
            .fontSize(9)
            .fillColor("#666")
            .text(meta.join("  ·  "));
          doc.moveDown(0.2);
          doc.fillColor("#000");
        }

        if (card.description) {
          doc.font("Regular").fontSize(10).text(card.description);
          doc.moveDown(0.2);
        }

        for (const cl of card.checklists) {
          doc.font("Bold").fontSize(10).text(cl.title);
          doc.font("Regular").fontSize(10);
          for (const it of cl.items) {
            doc.text(`  ${it.done ? "✓" : "○"} ${it.text}`);
          }
          doc.moveDown(0.2);
        }

        if (card.comments.length > 0) {
          doc.font("Bold").fontSize(9).fillColor("#444").text("Комментарии");
          doc.font("Regular").fontSize(9);
          for (const c of card.comments) {
            const who = c.author?.name || c.author?.email || "Удалён";
            const when = format(c.createdAt, "d MMM HH:mm", { locale: ru });
            doc
              .fillColor("#666")
              .text(`${who} (${when}):`, { continued: true })
              .fillColor("#000")
              .text(` ${c.body.replace(/\n/g, " ")}`);
          }
          doc.moveDown(0.2);
        }

        // Тонкий разделитель между карточками
        doc
          .moveDown(0.3)
          .strokeColor("#eee")
          .lineWidth(0.5)
          .moveTo(doc.x, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .stroke();
        doc.moveDown(0.5);
        doc.fillColor("#000");
      }

      doc.moveDown(0.5);
    }

    doc.end();
  });
}
