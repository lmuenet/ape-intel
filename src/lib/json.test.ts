import { describe, expect, it } from "vitest";
import { extractJson } from "./json";

describe("extractJson", () => {
  it("pulls the contents of a fenced ```json block", () => {
    const text = 'prose\n```json\n{"a":1}\n```\nmore';
    expect(extractJson(text)).toBe('{"a":1}');
  });

  it("falls back to the widest brace span for a bare object with prose", () => {
    expect(extractJson('Here it is: {"a":1} done')).toBe('{"a":1}');
  });

  it("finds a top-level array with prose around it", () => {
    expect(extractJson('Result: [{"t":"X"}] end')).toBe('[{"t":"X"}]');
  });

  it("prefers the wider span when both braces and brackets appear", () => {
    // object wraps an array → object span is widest
    expect(extractJson('x {"items":[1,2]} y')).toBe('{"items":[1,2]}');
  });

  it("returns null when there is no JSON-ish span", () => {
    expect(extractJson("no json here")).toBeNull();
  });
});
