/**
 * Strict JSON extractor for model output. Handles markdown fences,
 * surrounding prose, and picks the outermost balanced `{...}` block — its
 * brace matcher tracks string state so a `}` literal inside a JSON string
 * can't close the object early. Shared by every AI consumer; prefer it over
 * ad-hoc `JSON.parse(text)`, which breaks the moment a model adds prose.
 */
export function extractJson<T = unknown>(text: string): T {
  let str = text.trim();

  const fence = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) str = fence[1].trim();

  const start = str.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in model output");

  let depth = 0;
  let end = start;
  let inString = false;
  let escape = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  const slice = str.slice(start, end + 1);
  return JSON.parse(slice) as T;
}
