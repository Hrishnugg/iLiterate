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
