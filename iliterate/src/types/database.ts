export type AgeGroup = "child" | "teen" | "adult";

export type EducationLevel =
  | "elementary"
  | "middle"
  | "high"
  | "college"
  | "graduate";

export type ProficiencyLevel =
  | "beginner"
  | "elementary"
  | "intermediate"
  | "upper_intermediate"
  | "advanced";

export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type ContentType =
  | "article"
  | "story"
  | "news"
  | "dialogue"
  | "menu"
  | "sign"
  | "pdf"
  | "epub";

export type QuizType = "comprehension" | "vocabulary" | "grammar";

export type LearningMotivation =
  | "travel"
  | "career"
  | "academic"
  | "personal"
  | "family"
  | "entertainment";

export interface Profile {
  id: string;
  native_language: string;
  target_language: string;
  age_group: AgeGroup | null;
  education_level: EducationLevel | null;
  years_learning: number;
  learning_motivation: LearningMotivation[];
  proficiency_level: ProficiencyLevel;
  created_at: string;
  updated_at: string;
}

export interface Streak {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  streak_start_date: string | null;
  created_at: string;
}

export interface Content {
  id: string;
  title: string;
  body: string;
  language: string;
  difficulty_level: CEFRLevel;
  numeric_level?: number;
  content_type: ContentType | null;
  topic_tags: string[];
  word_count: number | null;
  estimated_reading_time: number | null;
  source_url: string | null;
  is_generated: boolean;
  created_at: string;
}

export interface ReadingProgress {
  id: string;
  user_id: string;
  content_id: string;
  started_at: string;
  completed_at: string | null;
  last_position: number;
  wpm_setting: number;
  progress_percentage: number;
  words_read: number;
  updated_at: string;
}

export interface Vocabulary {
  id: string;
  word: string;
  language: string;
  pronunciation: string | null;
  definitions: Record<string, string>;
  part_of_speech: string | null;
  frequency_rank: number | null;
  created_at: string;
}

export interface UserVocabulary {
  id: string;
  user_id: string;
  vocabulary_id: string;
  content_id: string | null;
  context_sentence: string | null;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_date: string;
  times_reviewed: number;
  times_correct: number;
  last_reviewed_at: string | null;
  created_at: string;
}

export interface QuizResult {
  id: string;
  user_id: string;
  content_id: string | null;
  quiz_type: QuizType | null;
  score: number;
  max_score: number;
  questions_answered: number;
  time_taken_seconds: number | null;
  created_at: string;
}

export interface UserUpload {
  id: string;
  user_id: string;
  storage_path: string;
  extracted_text: string | null;
  language_detected: string | null;
  processed_at: string | null;
  created_at: string;
}

export type PositionType = "offset" | "xpath" | "cfi";

export interface Highlight {
  id: string;
  user_id: string;
  content_id: string;
  position_type: PositionType;
  start_position: string;
  end_position: string;
  selected_text: string;
  context_before: string | null;
  context_after: string | null;
  note: string | null;
  translation: string | null;
  transliteration: string | null;
  part_of_speech: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranslationLookup {
  id: string;
  user_id: string;
  content_id: string;
  source_text: string;
  translated_text: string;
  source_lang: string;
  target_lang: string;
  transliteration: string | null;
  created_at: string;
}

// ============================================================================
// Skill-Based Progress Tracking Types
// ============================================================================

/** CEFR to numeric level mapping ranges */
export const CEFR_LEVEL_RANGES = {
  A1: { min: 1, max: 3 },
  A2: { min: 4, max: 6 },
  B1: { min: 7, max: 10 },
  B2: { min: 11, max: 14 },
  C1: { min: 15, max: 17 },
  C2: { min: 18, max: 20 },
} as const;

/** Skill types tracked by the system */
export type SkillType = "reading" | "vocabulary" | "grammar";

/** Assessment/quiz types */
export type AssessmentType = "post_reading" | "level_check" | "placement";

/** Question types in assessments */
export type QuestionType =
  | "comprehension_mcq"
  | "vocabulary_fill_blank"
  | "grammar_mcq"
  | "grammar_fill_blank";

/** User's skill levels and XP progress */
export interface UserSkillLevels {
  id: string;
  user_id: string;
  reading_level: number;
  vocabulary_level: number;
  grammar_level: number;
  reading_xp: number;
  vocabulary_xp: number;
  grammar_xp: number;
  reading_weight: number;
  vocabulary_weight: number;
  grammar_weight: number;
  created_at: string;
  updated_at: string;
}

/** Individual question in an assessment */
export interface AssessmentQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  correct_answer: string;
  user_answer?: string;
  correct?: boolean;
  context?: string;
  hint?: string;
}

/** Level change record */
export interface LevelChange {
  from: number;
  to: number;
}

/** Complete assessment record */
export interface SkillAssessment {
  id: string;
  user_id: string;
  content_id: string | null;
  assessment_type: AssessmentType;
  questions: AssessmentQuestion[];
  reading_score: number | null;
  reading_max_score: number | null;
  vocabulary_score: number | null;
  vocabulary_max_score: number | null;
  grammar_score: number | null;
  grammar_max_score: number | null;
  reading_xp_awarded: number;
  vocabulary_xp_awarded: number;
  grammar_xp_awarded: number;
  level_changes: Partial<Record<SkillType, LevelChange>> | null;
  time_taken_seconds: number | null;
  created_at: string;
}

/** AI-generated content metadata */
export interface GeneratedContent {
  id: string;
  user_id: string;
  content_id: string | null;
  target_cefr_level: CEFRLevel;
  target_numeric_level: number;
  topic_requested: string | null;
  vocabulary_focus: string[];
  grammar_focus: string[];
  prompt_used: string | null;
  model_used: string;
  created_at: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Convert numeric level (1-20) to CEFR level */
export function numericLevelToCEFR(level: number): CEFRLevel {
  if (level <= 3) return "A1";
  if (level <= 6) return "A2";
  if (level <= 10) return "B1";
  if (level <= 14) return "B2";
  if (level <= 17) return "C1";
  return "C2";
}

/** Get numeric range for a CEFR level */
export function cefrToNumericRange(cefr: CEFRLevel): { min: number; max: number } {
  return CEFR_LEVEL_RANGES[cefr];
}

/** Calculate overall level from individual skills and weights */
export function calculateOverallLevel(
  readingLevel: number,
  vocabularyLevel: number,
  grammarLevel: number,
  readingWeight: number,
  vocabularyWeight: number,
  grammarWeight: number
): number {
  return Math.floor(
    readingLevel * readingWeight +
    vocabularyLevel * vocabularyWeight +
    grammarLevel * grammarWeight
  );
}
