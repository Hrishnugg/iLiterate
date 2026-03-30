import { describe, expect, it } from "vitest";

import es from "@/locales/es.json";
import ja from "@/locales/ja.json";
import { resolveKey, translate } from "../index";

describe("i18n translate", () => {
  it("falls back to English when the active locale is missing a key", () => {
    expect(translate(ja, "social.friends")).toBe("Friends");
  });

  it("interpolates replacement values", () => {
    expect(translate(es, "social.ago", { time: "5m" })).toBe("hace 5m");
  });

  it("still returns the raw key when no locale provides it", () => {
    expect(resolveKey(es, "social.doesNotExist")).toBe("social.doesNotExist");
    expect(translate(es, "social.doesNotExist")).toBe("social.doesNotExist");
  });
});
