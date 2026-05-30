import { describe, expect, it } from "vitest";
import { parseStrategy } from "./strategy";

const reply = (jsonLine: string): string =>
  ["Here is my analysis with lots of prose.", "```json", jsonLine, "```", "Hope that helps!"].join("\n");

describe("parseStrategy", () => {
  it("extracts and parses the fenced json block out of a full reply", () => {
    const out = parseStrategy(reply('{ "direction": "long", "timeframe": "2-4 weeks", "targetPrice": "150", "leverage": "2x", "rationale": "momentum" }'));
    expect(out).toEqual({
      direction: "long", timeframe: "2-4 weeks", targetPrice: "150", leverage: "2x", rationale: "momentum",
    });
  });

  it("returns only the keys that are present (tolerates missing)", () => {
    const out = parseStrategy(reply('{ "direction": "short" }'));
    expect(out).toEqual({ direction: "short" });
  });

  it("ignores unknown keys", () => {
    const out = parseStrategy(reply('{ "direction": "long", "foo": "bar" }'));
    expect(out).toEqual({ direction: "long" });
  });

  it("coerces non-string values to strings", () => {
    const out = parseStrategy(reply('{ "targetPrice": 150, "leverage": 3 }'));
    expect(out).toEqual({ targetPrice: "150", leverage: "3" });
  });

  it("parses bare JSON with no code fence", () => {
    expect(parseStrategy('{ "direction": "short" }')).toEqual({ direction: "short" });
  });

  it("returns null when there is no json and no bare object", () => {
    expect(parseStrategy("just some prose, nothing structured here")).toBeNull();
  });

  it("returns null for broken json in the fence", () => {
    expect(parseStrategy(reply("{ not valid json }"))).toBeNull();
  });

  it("returns null when the json is an array, not an object", () => {
    expect(parseStrategy(reply('["long", "short"]'))).toBeNull();
  });
});
