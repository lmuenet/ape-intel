/**
 * Best-effort extraction of a JSON span from free-form LLM output.
 * Prefers a fenced ```json block; otherwise takes the widest bracket-delimited
 * span ({…} or […]) so a bare object or array surrounded by prose still parses.
 * JSON.parse by the caller validates the result.
 */
export function extractJson(text: string): string | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();

  const spans: Array<[number, number]> = [];
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) spans.push([firstBrace, lastBrace]);
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) spans.push([firstBracket, lastBracket]);
  if (spans.length === 0) return null;

  const [start, end] = spans.sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
  return text.slice(start, end + 1);
}
