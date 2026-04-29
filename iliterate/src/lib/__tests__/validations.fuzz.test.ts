/**
 * Validations — Property-Based / Fuzz Testing with fast-check
 *
 * Testing methods:
 * 1. Property-based testing (fast-check): generates thousands of random inputs
 *    to verify schema invariants hold for all values, not just hand-picked ones.
 * 2. Fuzz testing: random strings, boundary values, and adversarial inputs
 *    to verify schemas reject invalid data without throwing exceptions.
 *
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  uuidSchema,
  languageSchema,
  translateRequestSchema,
  ttsRequestSchema,
  ttsWordRequestSchema,
  highlightRequestSchema,
  vocabularyRequestSchema,
  readingProgressRequestSchema,
  validateRequestBody,
} from "../validations";

// ---------------------------------------------------------------------------
// UUID Schema — Property-Based Tests
// ---------------------------------------------------------------------------
describe("uuidSchema (property-based)", () => {
  it("accepts all valid v4 UUIDs", () => {
    fc.assert(
      fc.property(fc.uuid(), (uuid) => {
        expect(uuidSchema.safeParse(uuid).success).toBe(true);
      }),
      { numRuns: 500 }
    );
  });

  it("rejects random non-UUID strings", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)),
        (s) => {
          expect(uuidSchema.safeParse(s).success).toBe(false);
        }
      ),
      { numRuns: 500 }
    );
  });
});

// ---------------------------------------------------------------------------
// Language Schema — Fuzz Tests
// ---------------------------------------------------------------------------
describe("languageSchema (fuzz)", () => {
  it("accepts known ISO codes", () => {
    const validCodes = ["en", "es", "fr", "de", "ja", "ko", "zh", "ar"];
    for (const code of validCodes) {
      expect(languageSchema.safeParse(code).success).toBe(true);
    }
  });

  it("accepts 2-3 letter ISO patterns", () => {
    const lowercaseLetters = "abcdefghijklmnopqrstuvwxyz".split("");
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 3 }).chain((len) =>
          fc.tuple(...Array.from({ length: len }, () => fc.constantFrom(...lowercaseLetters)))
            .map((chars) => chars.join(""))
        ),
        (code) => {
          // All 2-3 letter lowercase strings should match the ISO code regex
          expect(languageSchema.safeParse(code).success).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("rejects empty string", () => {
    expect(languageSchema.safeParse("").success).toBe(false);
  });

  it("rejects single character", () => {
    expect(languageSchema.safeParse("a").success).toBe(false);
  });

  it("rejects very long strings", () => {
    const longStr = "a".repeat(51);
    expect(languageSchema.safeParse(longStr).success).toBe(false);
  });

  it("never throws an exception on arbitrary input", () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        // Should never throw — only return success/failure
        const result = languageSchema.safeParse(input);
        expect(typeof result.success).toBe("boolean");
      }),
      { numRuns: 1000 }
    );
  });
});

// ---------------------------------------------------------------------------
// translateRequestSchema — Property-Based Tests
// ---------------------------------------------------------------------------
describe("translateRequestSchema (property-based)", () => {
  const validRequest = fc.record({
    text: fc.string({ minLength: 1, maxLength: 100 }),
    sourceLang: fc.constantFrom("en", "es", "fr", "auto"),
    targetLang: fc.constantFrom("en", "es", "fr", "de", "ja"),
  });

  it("accepts valid translation requests", () => {
    fc.assert(
      fc.property(validRequest, (req) => {
        expect(translateRequestSchema.safeParse(req).success).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("rejects requests with empty text", () => {
    const result = translateRequestSchema.safeParse({
      text: "",
      sourceLang: "en",
      targetLang: "es",
    });
    expect(result.success).toBe(false);
  });

  it("rejects requests with text exceeding 10000 chars", () => {
    const result = translateRequestSchema.safeParse({
      text: "a".repeat(10001),
      sourceLang: "en",
      targetLang: "es",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional context fields", () => {
    const result = translateRequestSchema.safeParse({
      text: "hello",
      sourceLang: "en",
      targetLang: "es",
      contextBefore: "greeting",
      contextAfter: "farewell",
    });
    expect(result.success).toBe(true);
  });

  it("rejects context exceeding 500 chars", () => {
    const result = translateRequestSchema.safeParse({
      text: "hello",
      sourceLang: "en",
      targetLang: "es",
      contextBefore: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ttsRequestSchema — Property Tests
// ---------------------------------------------------------------------------
describe("ttsRequestSchema (property-based)", () => {
  it("requires at least one of contentId or lessonId", () => {
    expect(ttsRequestSchema.safeParse({}).success).toBe(false);
  });

  it("accepts valid contentId", () => {
    fc.assert(
      fc.property(fc.uuid(), (id) => {
        expect(ttsRequestSchema.safeParse({ contentId: id }).success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("accepts valid lessonId", () => {
    fc.assert(
      fc.property(fc.uuid(), (id) => {
        expect(ttsRequestSchema.safeParse({ lessonId: id }).success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// ttsWordRequestSchema — Fuzz Tests
// ---------------------------------------------------------------------------
describe("ttsWordRequestSchema (fuzz)", () => {
  it("accepts valid word + language combos", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom("en", "es", "ja", "ko"),
        (text, lang) => {
          expect(ttsWordRequestSchema.safeParse({ text, language: lang }).success).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("rejects empty text", () => {
    expect(ttsWordRequestSchema.safeParse({ text: "", language: "en" }).success).toBe(false);
  });

  it("rejects text over 500 chars", () => {
    expect(
      ttsWordRequestSchema.safeParse({ text: "x".repeat(501), language: "en" }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// vocabularyRequestSchema — Fuzz Tests
// ---------------------------------------------------------------------------
describe("vocabularyRequestSchema (fuzz)", () => {
  it("accepts minimal valid vocabulary entry", () => {
    const result = vocabularyRequestSchema.safeParse({
      word: "hola",
      language: "es",
      translation: "hello",
    });
    expect(result.success).toBe(true);
  });

  it("never throws on random objects", () => {
    fc.assert(
      fc.property(
        fc.record({
          word: fc.anything(),
          language: fc.anything(),
          translation: fc.anything(),
          definitions: fc.anything(),
        }),
        (obj) => {
          const result = vocabularyRequestSchema.safeParse(obj);
          expect(typeof result.success).toBe("boolean");
        }
      ),
      { numRuns: 500 }
    );
  });

  it("rejects word exceeding 200 chars", () => {
    expect(
      vocabularyRequestSchema.safeParse({
        word: "a".repeat(201),
        language: "en",
        translation: "test",
      }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// readingProgressRequestSchema — Boundary Tests
// ---------------------------------------------------------------------------
describe("readingProgressRequestSchema (boundary)", () => {
  it("accepts valid progress update", () => {
    fc.assert(
      fc.property(fc.uuid(), fc.integer({ min: 0, max: 100 }), (id, progress) => {
        expect(
          readingProgressRequestSchema.safeParse({ contentId: id, progress }).success
        ).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("rejects progress > 100", () => {
    expect(
      readingProgressRequestSchema.safeParse({
        contentId: "550e8400-e29b-41d4-a716-446655440000",
        progress: 101,
      }).success
    ).toBe(false);
  });

  it("rejects negative progress", () => {
    expect(
      readingProgressRequestSchema.safeParse({
        contentId: "550e8400-e29b-41d4-a716-446655440000",
        progress: -1,
      }).success
    ).toBe(false);
  });

  it("rejects negative wordsRead", () => {
    expect(
      readingProgressRequestSchema.safeParse({
        contentId: "550e8400-e29b-41d4-a716-446655440000",
        wordsRead: -5,
      }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// highlightRequestSchema — Fuzz Tests
// ---------------------------------------------------------------------------
describe("highlightRequestSchema (fuzz)", () => {
  it("requires contentId or lessonId", () => {
    expect(
      highlightRequestSchema.safeParse({
        positionType: "offset",
        startPosition: 0,
        endPosition: 10,
        selectedText: "hello",
      }).success
    ).toBe(false);
  });

  it("accepts valid highlight with contentId", () => {
    expect(
      highlightRequestSchema.safeParse({
        contentId: "550e8400-e29b-41d4-a716-446655440000",
        positionType: "offset",
        startPosition: 0,
        endPosition: 10,
        selectedText: "hello world",
      }).success
    ).toBe(true);
  });

  it("rejects selectedText over 5000 chars", () => {
    expect(
      highlightRequestSchema.safeParse({
        contentId: "550e8400-e29b-41d4-a716-446655440000",
        positionType: "offset",
        startPosition: 0,
        endPosition: 10,
        selectedText: "x".repeat(5001),
      }).success
    ).toBe(false);
  });

  it("rejects invalid positionType", () => {
    expect(
      highlightRequestSchema.safeParse({
        contentId: "550e8400-e29b-41d4-a716-446655440000",
        positionType: "invalid",
        startPosition: 0,
        endPosition: 10,
        selectedText: "test",
      }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateRequestBody — Integration Test
// ---------------------------------------------------------------------------
describe("validateRequestBody", () => {
  it("returns error for invalid JSON", async () => {
    const mockRequest = {
      json: () => Promise.reject(new Error("invalid")),
    } as unknown as Request;

    const result = await validateRequestBody(mockRequest, translateRequestSchema);
    expect(result.error).toBe("Invalid JSON body");
    expect(result.data).toBeNull();
  });

  it("returns parsed data for valid input", async () => {
    const mockRequest = {
      json: () =>
        Promise.resolve({
          text: "hello",
          sourceLang: "en",
          targetLang: "es",
        }),
    } as unknown as Request;

    const result = await validateRequestBody(mockRequest, translateRequestSchema);
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      text: "hello",
      sourceLang: "en",
      targetLang: "es",
    });
  });

  it("returns formatted error for schema validation failure", async () => {
    const mockRequest = {
      json: () => Promise.resolve({ text: "", sourceLang: "en", targetLang: "es" }),
    } as unknown as Request;

    const result = await validateRequestBody(mockRequest, translateRequestSchema);
    expect(result.error).toBeTruthy();
    expect(result.data).toBeNull();
  });
});
