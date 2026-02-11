import {
  SkillType,
  UserSkillLevels,
  numericLevelToCEFR,
  CEFRLevel,
} from "@/types/database";

// ============================================================================
// XP Configuration
// ============================================================================

/**
 * XP required to advance FROM each level (exponential growth).
 * Index = current level, value = XP needed to reach next level.
 * Level 20 is max, so index 20 is not used.
 */
export const XP_PER_LEVEL: readonly number[] = [
  0, // Level 0 (unused, levels start at 1)
  100, // Level 1 → 2
  150, // Level 2 → 3
  250, // Level 3 → 4 (A1 → A2 transition)
  350, // Level 4 → 5
  500, // Level 5 → 6
  700, // Level 6 → 7 (A2 → B1 transition)
  900, // Level 7 → 8
  1100, // Level 8 → 9
  1400, // Level 9 → 10
  1800, // Level 10 → 11 (B1 → B2 transition)
  2200, // Level 11 → 12
  2700, // Level 12 → 13
  3300, // Level 13 → 14
  4000, // Level 14 → 15 (B2 → C1 transition)
  5000, // Level 15 → 16
  6000, // Level 16 → 17
  7500, // Level 17 → 18 (C1 → C2 transition)
  9000, // Level 18 → 19
  11000, // Level 19 → 20
] as const;

/** Maximum level a user can reach */
export const MAX_LEVEL = 20;

// ============================================================================
// Types
// ============================================================================

/** XP award details for a single skill */
export interface XPAward {
  skill: SkillType;
  baseXP: number;
  bonusXP: number;
  totalXP: number;
  reason: string;
}

/** Result of checking for level-up */
export interface LevelUpResult {
  newLevel: number;
  remainingXP: number;
  leveledUp: boolean;
  levelsGained: number;
  newCEFR: CEFRLevel;
  crossedCEFRBoundary: boolean;
}

/** Suggested content level range for a user */
export interface ContentLevelSuggestion {
  minLevel: number;
  maxLevel: number;
  idealLevel: number;
  cefrRange: { min: CEFRLevel; max: CEFRLevel };
}

// ============================================================================
// XP Calculation Functions
// ============================================================================

/**
 * Calculate XP award for a quiz/assessment.
 *
 * @param score - Number of correct answers
 * @param maxScore - Total number of questions
 * @param contentLevel - Numeric level of the content (1-20)
 * @param userLevel - User's current level for this skill
 * @param skill - Which skill this is for
 * @returns XP award breakdown
 */
export function calculateQuizXP(
  score: number,
  maxScore: number,
  contentLevel: number,
  userLevel: number,
  skill: SkillType
): XPAward {
  if (maxScore === 0) {
    return { skill, baseXP: 0, bonusXP: 0, totalXP: 0, reason: "No questions" };
  }

  const percentage = score / maxScore;
  const reasons: string[] = [];

  // Base XP: 10-50 depending on performance
  let baseXP = Math.floor(percentage * 50);
  reasons.push(`${Math.round(percentage * 100)}% correct`);

  // Challenge bonus: Up to 50% bonus for harder content
  const levelDiff = contentLevel - userLevel;
  let bonusXP = 0;

  if (levelDiff > 0) {
    // Content is harder than user's level
    const challengeMultiplier = Math.min(levelDiff * 0.1, 0.5);
    bonusXP = Math.floor(baseXP * challengeMultiplier);
    reasons.push(`+${Math.round(challengeMultiplier * 100)}% challenge bonus`);
  } else if (levelDiff < -3) {
    // Content is too easy (more than 3 levels below)
    baseXP = Math.floor(baseXP * 0.5);
    reasons.push("reduced (content too easy)");
  }

  // Perfect score bonus
  if (percentage === 1 && maxScore >= 3) {
    bonusXP += 10;
    reasons.push("perfect score!");
  }

  // Minimum XP for attempting (even if all wrong)
  if (baseXP === 0 && maxScore > 0) {
    baseXP = 5;
    reasons.push("participation bonus");
  }

  return {
    skill,
    baseXP,
    bonusXP,
    totalXP: baseXP + bonusXP,
    reason: reasons.join(", "),
  };
}

/**
 * Calculate XP for reading completion based on content length and difficulty.
 */
export function calculateReadingXP(
  wordsRead: number,
  contentLevel: number,
  userLevel: number,
  completionPercentage: number
): XPAward {
  const reasons: string[] = [];

  // Base XP: 1 XP per 50 words read
  let baseXP = Math.floor(wordsRead / 50);
  reasons.push(`${wordsRead} words read`);

  // Completion bonus
  if (completionPercentage >= 95) {
    baseXP += 15;
    reasons.push("completed");
  } else if (completionPercentage >= 50) {
    baseXP += 5;
    reasons.push(`${Math.round(completionPercentage)}% progress`);
  }

  // Challenge bonus for harder content
  const levelDiff = contentLevel - userLevel;
  let bonusXP = 0;

  if (levelDiff > 0) {
    bonusXP = Math.floor(baseXP * Math.min(levelDiff * 0.1, 0.3));
    reasons.push("challenge bonus");
  }

  return {
    skill: "reading",
    baseXP,
    bonusXP,
    totalXP: baseXP + bonusXP,
    reason: reasons.join(", "),
  };
}

// ============================================================================
// Level-Up Functions
// ============================================================================

/**
 * Check if adding XP results in a level-up (or multiple level-ups).
 *
 * @param currentLevel - User's current level (1-20)
 * @param currentXP - User's current XP within the level
 * @param addedXP - XP being added
 * @returns New level, remaining XP, and whether they leveled up
 */
export function checkLevelUp(
  currentLevel: number,
  currentXP: number,
  addedXP: number
): LevelUpResult {
  let level = currentLevel;
  let xp = currentXP + addedXP;
  let levelsGained = 0;
  const startingCEFR = numericLevelToCEFR(currentLevel);

  // Process level-ups (can gain multiple levels at once)
  while (level < MAX_LEVEL && xp >= XP_PER_LEVEL[level]) {
    xp -= XP_PER_LEVEL[level];
    level++;
    levelsGained++;
  }

  // Cap XP at max if already at max level
  if (level >= MAX_LEVEL) {
    level = MAX_LEVEL;
  }

  const newCEFR = numericLevelToCEFR(level);
  const crossedCEFRBoundary = startingCEFR !== newCEFR;

  return {
    newLevel: level,
    remainingXP: xp,
    leveledUp: levelsGained > 0,
    levelsGained,
    newCEFR,
    crossedCEFRBoundary,
  };
}

/**
 * Get the XP required to reach the next level.
 */
export function getXPToNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return XP_PER_LEVEL[level];
}

/**
 * Get progress percentage towards next level.
 */
export function getLevelProgress(level: number, xp: number): number {
  if (level >= MAX_LEVEL) return 100;
  const required = XP_PER_LEVEL[level];
  if (required === 0) return 0;
  return Math.min(Math.floor((xp / required) * 100), 100);
}

/**
 * Calculate total XP accumulated across all levels.
 */
export function getTotalXPForLevel(level: number, currentXP: number): number {
  let total = currentXP;
  for (let i = 1; i < level; i++) {
    total += XP_PER_LEVEL[i];
  }
  return total;
}

// ============================================================================
// Overall Level Calculation
// ============================================================================

/**
 * Calculate the weighted overall level from individual skill levels.
 */
export function calculateWeightedOverallLevel(skills: UserSkillLevels): number {
  return Math.floor(
    skills.reading_level * skills.reading_weight +
      skills.vocabulary_level * skills.vocabulary_weight +
      skills.grammar_level * skills.grammar_weight
  );
}

/**
 * Get the CEFR level for the overall weighted level.
 */
export function getOverallCEFR(skills: UserSkillLevels): CEFRLevel {
  const overall = calculateWeightedOverallLevel(skills);
  return numericLevelToCEFR(overall);
}

// ============================================================================
// Content Recommendations
// ============================================================================

/**
 * Suggest appropriate content difficulty range based on user's levels.
 *
 * @param skills - User's skill levels
 * @param focusSkill - Optional specific skill to focus on
 * @returns Suggested content level range
 */
export function suggestContentLevel(
  skills: UserSkillLevels,
  focusSkill?: SkillType
): ContentLevelSuggestion {
  let baseLevel: number;

  if (focusSkill) {
    // Use the specific skill level
    baseLevel = skills[`${focusSkill}_level` as keyof UserSkillLevels] as number;
  } else {
    // Use overall weighted level
    baseLevel = calculateWeightedOverallLevel(skills);
  }

  // Allow content slightly below to slightly above user's level
  const minLevel = Math.max(1, baseLevel - 2);
  const maxLevel = Math.min(MAX_LEVEL, baseLevel + 2);

  return {
    minLevel,
    maxLevel,
    idealLevel: baseLevel,
    cefrRange: {
      min: numericLevelToCEFR(minLevel),
      max: numericLevelToCEFR(maxLevel),
    },
  };
}

/**
 * Check if content is appropriate for a user's level.
 *
 * @param contentLevel - The content's numeric level
 * @param userLevel - The user's relevant skill level
 * @returns Object indicating if content is appropriate and why
 */
export function isContentAppropriate(
  contentLevel: number,
  userLevel: number
): { appropriate: boolean; reason: string; difficulty: "easy" | "appropriate" | "challenging" | "too_hard" } {
  const diff = contentLevel - userLevel;

  if (diff < -4) {
    return {
      appropriate: false,
      reason: "Content is too easy and won't help you progress",
      difficulty: "easy",
    };
  }
  if (diff > 4) {
    return {
      appropriate: false,
      reason: "Content is too difficult for your current level",
      difficulty: "too_hard",
    };
  }
  if (diff >= -2 && diff <= 0) {
    return {
      appropriate: true,
      reason: "Content matches your level well",
      difficulty: "appropriate",
    };
  }
  if (diff > 0 && diff <= 2) {
    return {
      appropriate: true,
      reason: "Content is challenging but achievable",
      difficulty: "challenging",
    };
  }
  // diff between -4 and -2, or between 2 and 4
  return {
    appropriate: true,
    reason: diff < 0 ? "Content is slightly easy" : "Content is quite challenging",
    difficulty: diff < 0 ? "easy" : "challenging",
  };
}

// ============================================================================
// Skill Weight Presets
// ============================================================================

/** Predefined weight presets for common learning focuses */
export const WEIGHT_PRESETS = {
  balanced: {
    reading: 0.34,
    vocabulary: 0.33,
    grammar: 0.33,
    description: "Equal focus on all skills",
  },
  reading_focus: {
    reading: 0.5,
    vocabulary: 0.3,
    grammar: 0.2,
    description: "Emphasize reading comprehension",
  },
  vocabulary_focus: {
    reading: 0.2,
    vocabulary: 0.5,
    grammar: 0.3,
    description: "Build vocabulary first",
  },
  grammar_focus: {
    reading: 0.25,
    vocabulary: 0.25,
    grammar: 0.5,
    description: "Focus on grammar accuracy",
  },
  conversational: {
    reading: 0.3,
    vocabulary: 0.45,
    grammar: 0.25,
    description: "Optimize for conversation",
  },
} as const;

export type WeightPresetKey = keyof typeof WEIGHT_PRESETS;
