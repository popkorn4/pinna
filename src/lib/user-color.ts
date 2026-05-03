// Стабильный цвет пользователя на доске.
// Hue выбирается детерминированно из (userId + boardId), но насыщенность и
// светлота зафиксированы так, чтобы текст оставался читаемым в обеих темах.
//
// почему привязка к доске: один и тот же пользователь на разных досках может
// иметь разные цвета — это естественно и помогает запоминать команду.

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
}

/**
 * Цвет имени пользователя в ленте активности.
 * @param theme — "light" или "dark"; цвет адаптируется
 */
export function userTextColor(
  userId: string,
  boardId: string,
  theme: "light" | "dark" = "light",
): string {
  const hue = djb2(userId + boardId) % 360;
  // Светлая тема: тёмный, насыщенный, контрастный к кремовому фону
  // Тёмная тема: светлый, мягкий, контрастный к графитовому
  if (theme === "dark") return `hsl(${hue} 70% 75%)`;
  return `hsl(${hue} 65% 35%)`;
}
