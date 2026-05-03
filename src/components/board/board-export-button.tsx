"use client";

import { Download, FileJson, FileText } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportBoardJson,
  exportBoardMarkdown,
} from "@/server/export-actions";

type Props = {
  boardId: string;
  boardTitle: string;
};

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeFilename(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "board";
}

export function BoardExportButton({ boardId, boardTitle }: Props) {
  const [pending, startTransition] = useTransition();
  const base = safeFilename(boardTitle);

  function exportAs(fmt: "json" | "md") {
    startTransition(async () => {
      try {
        const content =
          fmt === "json"
            ? await exportBoardJson(boardId)
            : await exportBoardMarkdown(boardId);
        downloadBlob(
          content,
          `${base}.${fmt}`,
          fmt === "json" ? "application/json" : "text/markdown",
        );
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Не удалось экспортировать",
        );
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          <Download className="size-4" /> Экспорт
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => exportAs("md")}>
          <FileText className="size-4" /> Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => exportAs("json")}>
          <FileJson className="size-4" /> JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
