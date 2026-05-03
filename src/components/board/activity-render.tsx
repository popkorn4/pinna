"use client";

import { format } from "date-fns";
import { ru } from "date-fns/locale";

type Row = {
  type: string;
  payload: unknown;
};

export function renderActivity(row: Row): React.ReactNode {
  const p = (row.payload as Record<string, unknown>) ?? {};
  const title = (p.title as string) || (p.cardTitle as string) || "";
  switch (row.type) {
    case "CARD_CREATED":
      return (
        <>
          создал(а) карточку <em>«{title}»</em>
        </>
      );
    case "CARD_RENAMED":
      return (
        <>
          переименовал(а) <em>«{p.from as string}»</em> в{" "}
          <em>«{p.to as string}»</em>
        </>
      );
    case "CARD_MOVED":
      return (
        <>
          перенёс(ла) <em>«{title}»</em> из{" "}
          <span className="font-mono text-xs">«{p.from as string}»</span> в{" "}
          <span className="font-mono text-xs">«{p.to as string}»</span>
        </>
      );
    case "CARD_DUE_SET":
      return (
        <>
          поставил(а) дедлайн{" "}
          {p.dueDate
            ? format(new Date(p.dueDate as string), "d MMM yyyy", {
                locale: ru,
              })
            : ""}{" "}
          на <em>«{title}»</em>
        </>
      );
    case "CARD_DUE_REMOVED":
      return (
        <>
          убрал(а) дедлайн с <em>«{title}»</em>
        </>
      );
    case "CARD_ARCHIVED":
      return (
        <>
          отправил(а) <em>«{title}»</em> в архив
        </>
      );
    case "CARD_DELETED":
      return (
        <>
          удалил(а) карточку <em>«{title}»</em>
        </>
      );
    case "CHECKLIST_ITEM_TOGGLED":
      return p.done ? (
        <>
          отметил(а) пункт <em>«{p.text as string}»</em> как сделанный в{" "}
          <em>«{p.cardTitle as string}»</em>
        </>
      ) : (
        <>
          снял(а) галку с <em>«{p.text as string}»</em> в{" "}
          <em>«{p.cardTitle as string}»</em>
        </>
      );
    case "COMMENT_CREATED":
      return (
        <>
          оставил(а) комментарий к <em>«{p.cardTitle as string}»</em>
          {p.preview ? (
            <span className="block text-muted-foreground italic mt-0.5">
              «{(p.preview as string).slice(0, 80)}
              {(p.preview as string).length > 80 ? "…" : ""}»
            </span>
          ) : null}
        </>
      );
    case "MEMBER_JOINED":
      return <>присоединил(ся/ась) к доске</>;
    default:
      return <>{row.type}</>;
  }
}
