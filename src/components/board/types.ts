// Общие типы карточки/колонки на клиенте — чтобы не таскать Prisma-типы.

export type LabelView = {
  id: string;
  name: string;
  color: string;
};

export type CardView = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  dueDate: Date | null;
  assignee: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  labels: LabelView[];
};

export type ColumnView = {
  id: string;
  title: string;
  position: number;
  cards: CardView[];
};

export type BoardView = {
  id: string;
  title: string;
  columns: ColumnView[];
  labels: LabelView[];
};
