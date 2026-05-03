// Детерминированный пастельный hue из id — для цветной полоски на карточке доски.
// почему djb2: дёшево, без зависимостей, достаточно "случайно" распределяет hue.
export function hueFromId(id: string): number {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 33) ^ id.charCodeAt(i);
  }
  return Math.abs(hash) % 360;
}

export function boardAccent(id: string): string {
  return `hsl(${hueFromId(id)} 55% 55%)`;
}
