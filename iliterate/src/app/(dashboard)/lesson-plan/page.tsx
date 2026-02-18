"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Clock, Target, ChevronRight, Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { numericLevelToCEFR } from "@/types/database";
import { DowngradeLevelDialog } from "@/components/lesson/DowngradeLevelDialog";

interface TopicInfo {
  id: string;
  name: string;
  icon: string;
}

interface LessonHistoryItem {
  id: string;
  title: string;
  topic: TopicInfo;
  targetLevel: number;
  length: string;
  wordCount: number;
  status: "reading" | "quiz" | "completed";
  quizScore: number | null;
  quizMaxScore: number | null;
  percentage: number | null;
  levelAdjustment: number | null;
  readingXpAwarded: number | null;
  vocabularyXpAwarded: number | null;
  createdAt: string;
  completedAt: string | null;
}

interface LessonData {
  id: string;
  title: string;
  body: string;
  targetLevel: number;
  topic: TopicInfo;
  length: string;
  wordCount: number;
  vocabulary: Array<{ word: string; translation: string; context: string }>;
  status: "reading" | "quiz" | "completed";
  createdAt: string;
}

const TOPICS = [
  { id: "travel", name: "Travel & Tourism", icon: "✈️" },
  { id: "food", name: "Food & Dining", icon: "🍽️" },
  { id: "daily_life", name: "Daily Life", icon: "🏠" },
  { id: "culture", name: "Culture & Traditions", icon: "🎭" },
  { id: "work", name: "Work & Career", icon: "💼" },
  { id: "news", name: "News & Current Events", icon: "📰" },
  { id: "nature", name: "Nature & Environment", icon: "🌿" },
  { id: "technology", name: "Technology", icon: "💻" },
  { id: "relationships", name: "People & Relationships", icon: "👥" },
  { id: "health", name: "Health & Wellness", icon: "🏃" },
  { id: "entertainment", name: "Entertainment", icon: "🎬" },
  { id: "education", name: "Education & Learning", icon: "📚" },
] as const;

const LENGTH_OPTIONS = [
  { id: "short", label: "Short", description: "~1 min read", words: "50-100 words" },
  { id: "medium", label: "Medium", description: "~5 min read", words: "200-400 words" },
  { id: "long", label: "Long", description: "~10 min read", words: "600-1000 words" },
] as const;

export default function LessonPlanPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userLevel, setUserLevel] = useState<number>(1);
  const [currentLesson, setCurrentLesson] = useState<LessonData | null>(null);
  const [recentLessons, setRecentLessons] = useState<LessonHistoryItem[]>([]);

  const [selectedLength, setSelectedLength] = useState<"short" | "medium" | "long">("medium");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [showTopicSelector, setShowTopicSelector] = useState(false);
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // Fetch user's skill level
      const progressResponse = await fetch("/api/progress");
      if (progressResponse.ok) {
        const progressData = await progressResponse.json();
        setUserLevel(progressData.skillLevels?.reading_level || 1);
      }

      // Fetch lesson history
      const historyResponse = await fetch("/api/lesson/history?limit=5");
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setRecentLessons(historyData.lessons || []);

        // Check for an active (non-completed) lesson
        const activeLesson = historyData.lessons?.find(
          (l: LessonHistoryItem) => l.status !== "completed"
        );
        if (activeLesson) {
          // Fetch full lesson details
          const lessonResponse = await fetch(`/api/lesson/${activeLesson.id}`);
          if (lessonResponse.ok) {
            const lessonData = await lessonResponse.json();
            setCurrentLesson(lessonData.lesson);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Failed to load lesson data");
    } finally {
      setIsLoading(false);
    }
  };

  const generateLesson = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      const response = await fetch("/api/lesson/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: selectedTopic || undefined,
          length: selectedLength,
          useSuggestedTopic: !selectedTopic,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate lesson");
      }

      const data = await response.json();
      setCurrentLesson(data.lesson);
      setSelectedTopic(null);
      setShowTopicSelector(false);

      // Navigate to the lesson
      router.push(`/lesson-plan/${data.lesson.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate lesson");
    } finally {
      setIsGenerating(false);
    }
  };

  const continueLesson = () => {
    if (currentLesson) {
      router.push(`/lesson-plan/${currentLesson.id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const cefrLevel = numericLevelToCEFR(userLevel);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Lesson Plan</h1>
        <p className="text-muted-foreground mt-1">
          Practice reading with content tailored to your level
        </p>
      </div>

      {/* Current Level Display */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Reading Level</p>
                <p className="text-xl font-bold">
                  Level {userLevel} <span className="text-muted-foreground">({cefrLevel})</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">CEFR Level</p>
              <p className="text-2xl font-bold text-primary">{cefrLevel}</p>
              {userLevel > 3 && (
                <button
                  onClick={() => setShowDowngradeDialog(true)}
                  className="text-xs text-muted-foreground hover:text-orange-500 hover:underline mt-1"
                >
                  Level too hard?
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Downgrade Level Dialog */}
      <DowngradeLevelDialog
        open={showDowngradeDialog}
        onOpenChange={setShowDowngradeDialog}
        onDowngradeComplete={fetchData}
      />

      {/* Active Lesson Card */}
      {currentLesson && currentLesson.status !== "completed" && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Continue Your Lesson
            </CardTitle>
            <CardDescription>
              {currentLesson.status === "reading" ? "You have a reading in progress" : "Ready to take the quiz"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">{currentLesson.title}</h3>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span>{currentLesson.topic.icon} {currentLesson.topic.name}</span>
                  <span>•</span>
                  <span>Level {currentLesson.targetLevel}</span>
                  <span>•</span>
                  <span>{currentLesson.wordCount} words</span>
                </div>
              </div>
              <Button onClick={continueLesson}>
                {currentLesson.status === "reading" ? "Continue Reading" : "Take Quiz"}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Lesson */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            New Lesson
          </CardTitle>
          <CardDescription>
            Practice reading with content tailored to your current level
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Length Selection */}
          <div>
            <label className="text-sm font-medium mb-3 block">Reading Length</label>
            <div className="grid grid-cols-3 gap-3">
              {LENGTH_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelectedLength(option.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedLength === option.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">{option.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                  <p className="text-xs text-muted-foreground">{option.words}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Topic Selection */}
          <div>
            <label className="text-sm font-medium mb-3 block">Topic</label>
            {!showTopicSelector ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 p-3 rounded-lg bg-muted/50 text-sm">
                  {selectedTopic ? (
                    <span>
                      {TOPICS.find(t => t.id === selectedTopic)?.icon}{" "}
                      {TOPICS.find(t => t.id === selectedTopic)?.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      A topic will be suggested based on your learning goals
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTopicSelector(true)}
                >
                  {selectedTopic ? "Change" : "Choose Topic"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {TOPICS.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => {
                        setSelectedTopic(topic.id);
                        setShowTopicSelector(false);
                      }}
                      className={`p-3 rounded-lg border text-left text-sm transition-all ${
                        selectedTopic === topic.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span className="mr-2">{topic.icon}</span>
                      {topic.name}
                    </button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedTopic(null);
                    setShowTopicSelector(false);
                  }}
                >
                  Surprise Me
                </Button>
              </div>
            )}
          </div>

          {/* Begin Lesson Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={generateLesson}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparing Lesson...
              </>
            ) : (
              <>
                <BookOpen className="mr-2 h-4 w-4" />
                Begin Lesson
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Lessons */}
      {recentLessons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Recent Lessons
            </CardTitle>
            <CardDescription>Your lesson history and performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentLessons.filter(l => l.status === "completed").slice(0, 5).map((lesson) => (
                <div
                  key={lesson.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        lesson.percentage && lesson.percentage >= 80
                          ? "bg-green-500"
                          : lesson.percentage && lesson.percentage >= 50
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                    >
                      {lesson.percentage ?? 0}%
                    </div>
                    <div>
                      <p className="font-medium">{lesson.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {lesson.topic.icon} {lesson.topic.name} • Level {lesson.targetLevel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium text-yellow-600 dark:text-yellow-400">
                        +{(lesson.readingXpAwarded || 0) + (lesson.vocabularyXpAwarded || 0)} XP
                      </p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        {lesson.levelAdjustment === 1 && (
                          <>
                            <TrendingUp className="h-3 w-3 text-green-500" />
                            <span className="text-green-500">Level up</span>
                          </>
                        )}
                        {lesson.levelAdjustment === -1 && (
                          <>
                            <TrendingDown className="h-3 w-3 text-red-500" />
                            <span className="text-red-500">Review</span>
                          </>
                        )}
                        {lesson.levelAdjustment === 0 && (
                          <>
                            <Minus className="h-3 w-3" />
                            <span>Same level</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
