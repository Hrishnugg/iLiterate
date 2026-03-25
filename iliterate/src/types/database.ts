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

export type UploadScope = "content_import" | "study_chat" | "dm_attachment";
export type UploadStatus = "uploaded" | "processed" | "failed";
export type UploadKind = "image" | "pdf" | "docx" | "unknown";
export type KaraokePlaybackProvider =
  | "tts"
  | "soundcloud"
  | "apple_music"
  | "spotify";
export type KaraokeMusicProvider = Exclude<KaraokePlaybackProvider, "tts">;
export type KaraokeTrackPlaybackMode = "embedded" | "link_out";
export type KaraokeLegacyItemStatus =
  | "fetching_lyrics"
  | "needs_lyrics"
  | "needs_timing"
  | "ready"
  | "error";
export type KaraokeItemLyricsStatus =
  | "queued"
  | "matching"
  | "ready"
  | "needs_review"
  | "manual_fallback"
  | "error";
export type KaraokeItemTimingStatus =
  | "not_applicable"
  | "draft"
  | "ready"
  | "needs_review";
export type KaraokeItemStatus =
  | "matching"
  | "ready"
  | "needs_review"
  | "manual_fallback"
  | "error";
export type KaraokeLyricsJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";
export type ProviderCollectionKind = "tracks" | "playlists" | "recents";

export type QuizType = "comprehension" | "vocabulary" | "grammar";

export type LearningMotivation =
  | "travel"
  | "career"
  | "academic"
  | "personal"
  | "family"
  | "entertainment";

export type SpeechFormality =
  | "casual"
  | "standard"
  | "professional"
  | "academic";

export interface Profile {
  id: string;
  native_language: string;
  target_language: string;
  age_group: AgeGroup | null;
  education_level: EducationLevel | null;
  years_learning: number;
  learning_motivation: LearningMotivation[];
  proficiency_level: ProficiencyLevel;
  speech_formality: SpeechFormality;
  is_premium: boolean;
  daily_reviews_used: number;
  last_review_date: string | null;
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
  source_upload_id: string | null;
  is_generated: boolean;
  created_at: string;
}

export interface LyricCue {
  startMs: number;
  endMs: number;
  startOffset: number;
  endOffset: number;
  text: string;
}

export interface KaraokeLyricsLine {
  id: string;
  text: string;
}

export interface KaraokeTrackLink {
  provider: KaraokePlaybackProvider;
  providerTrackId: string;
  url: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  durationMs?: number;
  karaokeCapable: boolean;
  playbackMode: KaraokeTrackPlaybackMode;
}

export interface ProviderPlaylistSummary {
  provider: KaraokeMusicProvider;
  playlistId: string;
  title: string;
  curator: string;
  artworkUrl?: string;
  url?: string;
  description?: string;
  trackCount: number;
}

export interface ProviderLibraryItem {
  id: string;
  kind: "track" | "playlist";
  provider: KaraokeMusicProvider;
  title: string;
  subtitle: string;
  artworkUrl?: string;
  url?: string;
  durationMs?: number;
  track?: KaraokeTrackLink;
  playlist?: ProviderPlaylistSummary;
  metadata?: Record<string, unknown>;
}

export interface ProviderLibraryCollection {
  provider: KaraokeMusicProvider;
  key: ProviderCollectionKind;
  kind: ProviderCollectionKind;
  label: string;
  description?: string;
  items: ProviderLibraryItem[];
  cursor?: string | null;
  hasMore: boolean;
  connected: boolean;
  emptyMessage?: string;
}

export interface MusicProviderConnection {
  id: string;
  user_id: string;
  provider: KaraokeMusicProvider;
  token_type: string | null;
  expires_at: string | null;
  external_user_id: string | null;
  scopes: string[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ContentProviderTrack {
  id: string;
  user_id: string;
  content_id: string;
  provider: KaraokeMusicProvider;
  provider_track_id: string;
  url: string;
  title: string;
  artist: string;
  artwork_url: string | null;
  duration_ms: number | null;
  karaoke_capable: boolean;
  playback_mode: KaraokeTrackPlaybackMode;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KaraokeTimeline {
  id: string;
  user_id: string;
  content_id: string;
  provider: KaraokePlaybackProvider;
  cues: LyricCue[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KaraokeItem {
  id: string;
  user_id: string;
  title: string;
  artist: string;
  status: KaraokeLegacyItemStatus;
  lyrics_status: KaraokeItemLyricsStatus;
  timing_status: KaraokeItemTimingStatus;
  primary_provider: KaraokeMusicProvider;
  primary_track_id: string;
  primary_track_url: string;
  artwork_url: string | null;
  duration_ms: number | null;
  provider_sync_capable: boolean;
  last_match_confidence: number | null;
  last_match_source: string | null;
  last_match_metadata: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KaraokeItemTrack {
  id: string;
  user_id: string;
  karaoke_item_id: string;
  provider: KaraokeMusicProvider;
  provider_track_id: string;
  url: string;
  title: string;
  artist: string;
  artwork_url: string | null;
  duration_ms: number | null;
  karaoke_capable: boolean;
  playback_mode: KaraokeTrackPlaybackMode;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KaraokeLyrics {
  id: string;
  user_id: string;
  karaoke_item_id: string;
  source: string | null;
  text: string;
  lines: KaraokeLyricsLine[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KaraokeItemTimeline {
  id: string;
  user_id: string;
  karaoke_item_id: string;
  provider: KaraokeMusicProvider;
  cues: LyricCue[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KaraokeLyricsJob {
  id: string;
  user_id: string;
  karaoke_item_id: string;
  provider: KaraokeMusicProvider;
  status: KaraokeLyricsJobStatus;
  attempts: number;
  last_error: string | null;
  metadata: Record<string, unknown>;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KaraokeSetlistRow {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KaraokeSetlistItemRow {
  id: string;
  user_id: string;
  setlist_id: string;
  karaoke_item_id: string;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KaraokeItemSummary {
  id: string;
  title: string;
  artist: string;
  status: KaraokeItemStatus;
  lyricsStatus: KaraokeItemLyricsStatus;
  timingStatus: KaraokeItemTimingStatus;
  primaryProvider: KaraokeMusicProvider;
  artworkUrl?: string;
  durationMs?: number;
  providerSyncCapable: boolean;
  lineCount: number;
  hasLyrics: boolean;
  hasTimeline: boolean;
  track: KaraokeTrackLink | null;
  jobStatus?: KaraokeLyricsJobStatus;
  matchConfidence?: number;
  createdAt: string;
  updatedAt: string;
}

export interface KaraokeItemDetail extends KaraokeItemSummary {
  metadata: Record<string, unknown>;
  lyrics: KaraokeLyrics | null;
  timeline: KaraokeItemTimeline | null;
  lastMatchSource?: string | null;
  lastMatchMetadata?: Record<string, unknown>;
}

export interface KaraokeSetlistItem {
  id: string;
  karaokeItemId: string;
  sortOrder: number;
  metadata: Record<string, unknown>;
  item: KaraokeItemSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface KaraokeSetlist {
  id: string;
  name: string;
  isDefault: boolean;
  metadata: Record<string, unknown>;
  itemCount: number;
  items: KaraokeSetlistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ActiveKaraokeSession {
  setlistId: string | null;
  currentItemId: string | null;
  queueItemIds: string[];
  currentIndex: number;
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
  title: string | null;
  scope: UploadScope;
  status: UploadStatus;
  kind: UploadKind;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  source_url: string | null;
  extracted_text: string | null;
  language_detected: string | null;
  processed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type StudyChatRole = "user" | "assistant";

export interface StudyChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface StudyChatMessage {
  id: string;
  session_id: string;
  role: StudyChatRole;
  body: string;
  created_at: string;
}

export interface StudyChatSessionUpload {
  session_id: string;
  upload_id: string;
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
// Social Graph & Messaging Types
// ============================================================================

export type FriendshipStatus = "pending" | "accepted" | "declined";
export type DirectMessageKind = "text" | "attachment" | "mixed";
export type DirectMessageAttachmentType = "image" | "pdf" | "docx";

export type SocialRelationshipState =
  | "none"
  | "incoming"
  | "outgoing"
  | "friends";

export type SocialSearchMatch = "username" | "display_name" | "email";

export type RelationshipState = SocialRelationshipState;

export interface PublicProfile {
  id: string;
  username: string | null;
  display_name: string;
  avatar_seed: string | null;
  created_at: string;
  updated_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  recipient_id: string;
  user_one_id: string;
  user_two_id: string;
  status: FriendshipStatus;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FriendshipWithProfile {
  friendship: Friendship;
  profile: PublicProfile;
}

export interface DirectConversation {
  id: string;
  user_one_id: string;
  user_two_id: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  friend?: PublicProfile | null;
  unread_count?: number;
}

export interface ConversationRead {
  conversation_id: string;
  user_id: string;
  last_read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  message_kind: DirectMessageKind;
  primary_attachment_type: DirectMessageAttachmentType | null;
  attachment_count: number;
  attachments?: DirectMessageAttachment[];
  created_at: string;
}

export interface DirectMessageAttachment {
  id: string;
  message_id: string;
  upload_id: string;
  attachment_type: DirectMessageAttachmentType;
  file_name: string | null;
  mime_type: string | null;
  extracted_text: string | null;
  detected_language: string | null;
  storage_path: string | null;
  created_at: string;
}

export interface FriendRequestSummary {
  friendship: Friendship;
  profile: PublicProfile;
  direction: "incoming" | "outgoing";
}

export interface FriendSummary {
  friendship: Friendship;
  profile: PublicProfile;
  conversation_id: string | null;
  unread_count: number;
}

export interface ConversationSummary {
  conversation: DirectConversation;
  profile: PublicProfile;
  unread_count: number;
  last_read_at: string | null;
}

export interface SocialSearchResult {
  profile: PublicProfile;
  relationship: SocialRelationshipState;
  matched_by: SocialSearchMatch;
  friendship: Friendship | null;
  friendship_id?: string | null;
}

export interface SocialSummary {
  public_profile: PublicProfile | null;
  incoming_requests: FriendRequestSummary[];
  outgoing_requests: FriendRequestSummary[];
  friends: FriendSummary[];
  conversations: ConversationSummary[];
}

// ============================================================================
// Study Chat Types
// ============================================================================

export type StudyChatMessageRole = "user" | "assistant";

export interface StudyChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface StudyChatMessage {
  id: string;
  session_id: string;
  role: StudyChatMessageRole;
  body: string;
  created_at: string;
}

export interface StudyChatSessionUpload {
  session_id: string;
  upload_id: string;
  created_at: string;
  upload?: UserUpload | null;
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
// Bookmarks
// ============================================================================

export interface Bookmark {
  id: string;
  user_id: string;
  item_type: "content" | "lesson";
  item_id: string;
  created_at: string;
}

// ============================================================================
// Points & Leaderboard Types
// ============================================================================

export type PointSource =
  | "quiz_completion"
  | "reading_completion"
  | "lesson_completion"
  | "flashcard_review"
  | "streak_bonus"
  | "perfect_quiz";

export interface PointEvent {
  id: string;
  user_id: string;
  points: number;
  source: PointSource;
  source_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  points: number;
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
