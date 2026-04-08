/**
 * Level System — Comprehensive Test Suite
 *
 * Testing methods used:
 * 1. Unit testing with boundary values
 * 2. Regression testing (pinned expected outputs for XP calculations)
 * 3. Designed for mutation testing — every branch and constant exercised
 */

import { describe, it, expect } from "vitest";
import {
  calculateQuizXP,
  calculateReadingXP,
  checkLevelUp,
  getXPToNextLevel,
  getLevelProgress,
  getTotalXPForLevel,
  getDowngradedLevel,
  getPreviousCEFRTier,
  calculateWeightedOverallLevel,
  getOverallCEFR,
  suggestContentLevel,
  isContentAppropriate,
  getLevelDescription,
  getDescriptionsForCEFR,
  XP_PER_LEVEL,
  MAX_LEVEL,
  WEIGHT_PRESETS,
  CEFR_TIER_MAX_LEVELS,
} from "../level-system";

// ---------------------------------------------------------------------------
// calculateQuizXP
// ---------------------------------------------------------------------------
describe("calculateQuizXP", () => {
  it("returns 0 XP when maxScore is 0", () => {
    const award = calculateQuizXP(0, 0, 5, 5, "reading");
    expect(award.totalXP).toBe(0);
    expect(award.reason).toBe("No questions");
  });

  it("calculates base XP as floor(percentage * 50)", () => {
    // 4/5 = 80% → floor(0.8 * 50) = 40
    const award = calculateQuizXP(4, 5, 5, 5, "reading");
    expect(award.baseXP).toBe(40);
  });

  it("awards challenge bonus when content is harder", () => {
    // contentLevel 8, userLevel 5, diff = 3, multiplier = min(0.3, 0.5) = 0.3
    const award = calculateQuizXP(5, 5, 8, 5, "reading");
    expect(award.bonusXP).toBeGreaterThan(0);
    expect(award.reason).toContain("challenge bonus");
  });

  it("caps challenge bonus at 50%", () => {
    // diff = 10, multiplier = min(1.0, 0.5) = 0.5
    const award = calculateQuizXP(5, 5, 15, 5, "vocabulary");
    const expectedBonus = Math.floor(50 * 0.5); // 25
    // bonus includes perfect score bonus too (10)
    expect(award.bonusXP).toBe(expectedBonus + 10);
  });

  it("reduces XP when content is too easy (4+ levels below)", () => {
    const award = calculateQuizXP(5, 5, 1, 5, "grammar");
    expect(award.baseXP).toBe(25); // floor(50 * 0.5)
    expect(award.reason).toContain("reduced");
  });

  it("awards perfect score bonus for 100% on 3+ questions", () => {
    const award = calculateQuizXP(3, 3, 5, 5, "reading");
    expect(award.bonusXP).toBe(10);
    expect(award.reason).toContain("perfect score");
  });

  it("does NOT award perfect score bonus for < 3 questions", () => {
    const award = calculateQuizXP(2, 2, 5, 5, "reading");
    expect(award.bonusXP).toBe(0);
  });

  it("gives participation bonus (5 XP) when all answers wrong", () => {
    const award = calculateQuizXP(0, 5, 5, 5, "reading");
    expect(award.baseXP).toBe(5);
    expect(award.reason).toContain("participation");
  });
});

// ---------------------------------------------------------------------------
// calculateReadingXP
// ---------------------------------------------------------------------------
describe("calculateReadingXP", () => {
  it("calculates base XP as 1 per 50 words", () => {
    const award = calculateReadingXP(250, 5, 5, 30);
    expect(award.baseXP).toBe(5); // 250/50=5 base, no completion bonus at 30%
  });

  it("awards +15 completion bonus for >= 95%", () => {
    const award = calculateReadingXP(100, 5, 5, 100);
    expect(award.baseXP).toBe(2 + 15); // 100/50=2 + 15 completed
    expect(award.reason).toContain("completed");
  });

  it("awards +5 progress bonus for >= 50%", () => {
    const award = calculateReadingXP(100, 5, 5, 60);
    expect(award.baseXP).toBe(2 + 5);
    expect(award.reason).toContain("progress");
  });

  it("awards no completion bonus for < 50%", () => {
    const award = calculateReadingXP(100, 5, 5, 30);
    expect(award.baseXP).toBe(2);
  });

  it("awards challenge bonus for harder content", () => {
    const award = calculateReadingXP(500, 8, 5, 100);
    expect(award.bonusXP).toBeGreaterThan(0);
    expect(award.reason).toContain("challenge bonus");
  });

  it("skill is always 'reading'", () => {
    const award = calculateReadingXP(100, 5, 5, 100);
    expect(award.skill).toBe("reading");
  });
});

// ---------------------------------------------------------------------------
// checkLevelUp
// ---------------------------------------------------------------------------
describe("checkLevelUp", () => {
  it("does not level up when XP is insufficient", () => {
    const result = checkLevelUp(1, 0, 50);
    expect(result.leveledUp).toBe(false);
    expect(result.newLevel).toBe(1);
    expect(result.remainingXP).toBe(50);
  });

  it("levels up when XP meets threshold exactly", () => {
    const result = checkLevelUp(1, 0, 100); // XP_PER_LEVEL[1] = 100
    expect(result.leveledUp).toBe(true);
    expect(result.newLevel).toBe(2);
    expect(result.remainingXP).toBe(0);
    expect(result.levelsGained).toBe(1);
  });

  it("handles multi-level gains", () => {
    // Level 1→3: need 100 (lv1) + 150 (lv2) = 250
    const result = checkLevelUp(1, 0, 250);
    expect(result.newLevel).toBe(3);
    expect(result.levelsGained).toBe(2);
    expect(result.remainingXP).toBe(0);
  });

  it("caps at MAX_LEVEL", () => {
    const result = checkLevelUp(19, 0, 999999);
    expect(result.newLevel).toBe(MAX_LEVEL);
  });

  it("detects CEFR boundary crossing", () => {
    // Level 3 (A1) → Level 4 (A2) with 250 XP
    const result = checkLevelUp(3, 0, 250);
    expect(result.crossedCEFRBoundary).toBe(true);
    expect(result.newCEFR).toBe("A2");
  });

  it("does not flag CEFR crossing within same tier", () => {
    const result = checkLevelUp(1, 0, 100); // 1→2, both A1
    expect(result.crossedCEFRBoundary).toBe(false);
  });

  it("accumulates existing XP before level-up check", () => {
    const result = checkLevelUp(1, 90, 10); // 90+10 = 100 = threshold
    expect(result.leveledUp).toBe(true);
    expect(result.newLevel).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getXPToNextLevel
// ---------------------------------------------------------------------------
describe("getXPToNextLevel", () => {
  it("returns correct threshold for level 1", () => {
    expect(getXPToNextLevel(1)).toBe(100);
  });

  it("returns 0 at max level", () => {
    expect(getXPToNextLevel(MAX_LEVEL)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getLevelProgress
// ---------------------------------------------------------------------------
describe("getLevelProgress", () => {
  it("returns 0% at 0 XP", () => {
    expect(getLevelProgress(1, 0)).toBe(0);
  });

  it("returns 50% at half threshold", () => {
    expect(getLevelProgress(1, 50)).toBe(50);
  });

  it("caps at 100%", () => {
    expect(getLevelProgress(1, 999)).toBe(100);
  });

  it("returns 100% at max level", () => {
    expect(getLevelProgress(MAX_LEVEL, 0)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// getTotalXPForLevel
// ---------------------------------------------------------------------------
describe("getTotalXPForLevel", () => {
  it("at level 1 with 50 XP returns 50", () => {
    expect(getTotalXPForLevel(1, 50)).toBe(50);
  });

  it("at level 3 with 0 XP returns sum of levels 1+2 thresholds", () => {
    // XP_PER_LEVEL[1] + XP_PER_LEVEL[2] = 100 + 150 = 250
    expect(getTotalXPForLevel(3, 0)).toBe(250);
  });
});

// ---------------------------------------------------------------------------
// getDowngradedLevel
// ---------------------------------------------------------------------------
describe("getDowngradedLevel", () => {
  it("returns null for A1 levels (1-3)", () => {
    expect(getDowngradedLevel(1)).toBeNull();
    expect(getDowngradedLevel(3)).toBeNull();
  });

  it("downgrades A2 → A1 max (3)", () => {
    expect(getDowngradedLevel(4)).toBe(3);
    expect(getDowngradedLevel(6)).toBe(3);
  });

  it("downgrades B1 → A2 max (6)", () => {
    expect(getDowngradedLevel(7)).toBe(6);
  });

  it("downgrades C2 → C1 max (17)", () => {
    expect(getDowngradedLevel(18)).toBe(17);
    expect(getDowngradedLevel(20)).toBe(17);
  });
});

// ---------------------------------------------------------------------------
// getPreviousCEFRTier
// ---------------------------------------------------------------------------
describe("getPreviousCEFRTier", () => {
  it("returns null for A1", () => {
    expect(getPreviousCEFRTier(1)).toBeNull();
  });

  it("returns A1 for A2 level", () => {
    expect(getPreviousCEFRTier(4)).toBe("A1");
  });

  it("returns C1 for C2 level", () => {
    expect(getPreviousCEFRTier(18)).toBe("C1");
  });
});

// ---------------------------------------------------------------------------
// calculateWeightedOverallLevel & getOverallCEFR
// ---------------------------------------------------------------------------
describe("calculateWeightedOverallLevel", () => {
  const skills = {
    id: "1",
    user_id: "u1",
    reading_level: 10,
    vocabulary_level: 8,
    grammar_level: 6,
    reading_xp: 0,
    vocabulary_xp: 0,
    grammar_xp: 0,
    reading_weight: 0.34,
    vocabulary_weight: 0.33,
    grammar_weight: 0.33,
    created_at: "",
    updated_at: "",
  };

  it("calculates weighted floor correctly", () => {
    // floor(10*0.34 + 8*0.33 + 6*0.33) = floor(3.4+2.64+1.98) = floor(8.02) = 8
    expect(calculateWeightedOverallLevel(skills)).toBe(8);
  });

  it("getOverallCEFR returns correct CEFR for weighted level", () => {
    expect(getOverallCEFR(skills)).toBe("B1"); // level 8
  });
});

// ---------------------------------------------------------------------------
// suggestContentLevel
// ---------------------------------------------------------------------------
describe("suggestContentLevel", () => {
  const skills = {
    id: "1",
    user_id: "u1",
    reading_level: 10,
    vocabulary_level: 8,
    grammar_level: 6,
    reading_xp: 0,
    vocabulary_xp: 0,
    grammar_xp: 0,
    reading_weight: 0.34,
    vocabulary_weight: 0.33,
    grammar_weight: 0.33,
    created_at: "",
    updated_at: "",
  };

  it("suggests range ±2 around overall level", () => {
    const suggestion = suggestContentLevel(skills);
    expect(suggestion.idealLevel).toBe(8);
    expect(suggestion.minLevel).toBe(6);
    expect(suggestion.maxLevel).toBe(10);
  });

  it("uses specific skill level when focusSkill provided", () => {
    const suggestion = suggestContentLevel(skills, "reading");
    expect(suggestion.idealLevel).toBe(10);
  });

  it("clamps min to 1", () => {
    const lowSkills = { ...skills, reading_level: 1, vocabulary_level: 1, grammar_level: 1 };
    const suggestion = suggestContentLevel(lowSkills);
    expect(suggestion.minLevel).toBe(1);
  });

  it("clamps max to MAX_LEVEL", () => {
    const highSkills = { ...skills, reading_level: 20, vocabulary_level: 20, grammar_level: 20 };
    const suggestion = suggestContentLevel(highSkills);
    expect(suggestion.maxLevel).toBe(MAX_LEVEL);
  });
});

// ---------------------------------------------------------------------------
// isContentAppropriate
// ---------------------------------------------------------------------------
describe("isContentAppropriate", () => {
  it("flags 'easy' when diff < -4", () => {
    const result = isContentAppropriate(1, 10);
    expect(result.appropriate).toBe(false);
    expect(result.difficulty).toBe("easy");
  });

  it("flags 'too_hard' when diff > 4", () => {
    const result = isContentAppropriate(15, 5);
    expect(result.appropriate).toBe(false);
    expect(result.difficulty).toBe("too_hard");
  });

  it("returns 'appropriate' when diff is -2 to 0", () => {
    expect(isContentAppropriate(8, 10).difficulty).toBe("appropriate");
    expect(isContentAppropriate(10, 10).difficulty).toBe("appropriate");
  });

  it("returns 'challenging' when diff is 1-2", () => {
    expect(isContentAppropriate(12, 10).difficulty).toBe("challenging");
  });

  it("returns appropriate=true for slightly easy (diff -3 to -4)", () => {
    const result = isContentAppropriate(6, 10); // diff = -4
    expect(result.appropriate).toBe(true);
    expect(result.difficulty).toBe("easy");
  });

  it("returns appropriate=true for quite challenging (diff 3-4)", () => {
    const result = isContentAppropriate(14, 10); // diff = 4
    expect(result.appropriate).toBe(true);
    expect(result.difficulty).toBe("challenging");
  });
});

// ---------------------------------------------------------------------------
// getLevelDescription & getDescriptionsForCEFR
// ---------------------------------------------------------------------------
describe("getLevelDescription", () => {
  it("returns correct description for level 1", () => {
    const desc = getLevelDescription(1);
    expect(desc.title).toBe("First Steps");
    expect(desc.cefr).toBe("A1");
  });

  it("clamps to valid range", () => {
    expect(getLevelDescription(0).level).toBe(1);
    expect(getLevelDescription(25).level).toBe(20);
  });
});

describe("getDescriptionsForCEFR", () => {
  it("returns 3 descriptions for A1 (levels 1-3)", () => {
    const descs = getDescriptionsForCEFR("A1");
    expect(descs).toHaveLength(3);
    expect(descs.every((d) => d.cefr === "A1")).toBe(true);
  });

  it("returns 4 descriptions for B1 (levels 7-10)", () => {
    expect(getDescriptionsForCEFR("B1")).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Constants sanity checks (mutation testing targets)
// ---------------------------------------------------------------------------
describe("constants", () => {
  it("MAX_LEVEL is 20", () => {
    expect(MAX_LEVEL).toBe(20);
  });

  it("XP_PER_LEVEL has 20 entries (index 0-19)", () => {
    expect(XP_PER_LEVEL).toHaveLength(20);
  });

  it("XP_PER_LEVEL is monotonically increasing (after index 1)", () => {
    for (let i = 2; i < XP_PER_LEVEL.length; i++) {
      expect(XP_PER_LEVEL[i]).toBeGreaterThan(XP_PER_LEVEL[i - 1]);
    }
  });

  it("CEFR_TIER_MAX_LEVELS boundaries are correct", () => {
    expect(CEFR_TIER_MAX_LEVELS.A1).toBe(3);
    expect(CEFR_TIER_MAX_LEVELS.C2).toBe(20);
  });

  it("WEIGHT_PRESETS balanced sums to ~1.0", () => {
    const b = WEIGHT_PRESETS.balanced;
    expect(b.reading + b.vocabulary + b.grammar).toBeCloseTo(1.0, 1);
  });
});
