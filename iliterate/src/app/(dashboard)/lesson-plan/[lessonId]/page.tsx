"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  BookOpen,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Award,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Content, numericLevelToCEFR } from "@/types/database";
import { ArticleRenderer } from "@/components/reader/ArticleRenderer";

interface TopicInfo {
  id: string;
  name: string;
  icon: string;
}

interface VocabularyItem {
  word: string;
  translation: string;
  context: string;
}

interface QuizQuestion {
  id: string;
  type: "comprehension_mcq" | "vocabulary_fill_blank";
  question: string;
  options?: string[];
  correct_answer: string;
  context?: string;
  hint?: string;
  user_answer?: string;
  correct?: boolean;
}

interface QuizResults {
  gradedQuestions: QuizQuestion[];
  readingScore: number;
  readingMaxScore: number;
  vocabularyScore: number;
  vocabularyMaxScore: number;
  totalScore: number;
  totalMaxScore: number;
  percentage: number;
  levelAdjustment: number;
  xpAwarded: {
    reading: number;
    vocabulary: number;
    total: number;
  };
}

interface LessonData {
  id: string;
  title: string;
  body: string;
  targetLevel: number;
  language: string;
  topic: TopicInfo;
  length: string;
  wordCount: number;
  vocabulary: VocabularyItem[];
  status: "reading" | "quiz" | "completed";
  quizQuestions?: QuizQuestion[];
  quizScore?: number;
  quizMaxScore?: number;
  createdAt: string;
}

export default function LessonPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.lessonId as string;

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reading state
  const [isCompletingReading, setIsCompletingReading] = useState(false);

  // Quiz state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizResults, setQuizResults] = useState<QuizResults | null>(null);
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchLesson();
  }, [lessonId]);

  const fetchLesson = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/lesson/${lessonId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch lesson");
      }

      const data = await response.json();
      setLesson(data.lesson);

      // Initialize answers if quiz questions exist
      if (data.lesson.quizQuestions) {
        const initialAnswers: Record<string, string> = {};
        data.lesson.quizQuestions.forEach((q: QuizQuestion) => {
          initialAnswers[q.id] = "";
        });
        setAnswers(initialAnswers);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lesson");
    } finally {
      setIsLoading(false);
    }
  };

  const completeReading = async () => {
    try {
      setIsCompletingReading(true);
      const response = await fetch(`/api/lesson/${lessonId}/complete-reading`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to complete reading");
      }

      const data = await response.json();

      // Update lesson with quiz questions
      setLesson((prev) =>
        prev
          ? {
              ...prev,
              status: "quiz",
              quizQuestions: data.quizQuestions,
            }
          : null
      );

      // Initialize answers
      const initialAnswers: Record<string, string> = {};
      data.quizQuestions.forEach((q: QuizQuestion) => {
        initialAnswers[q.id] = "";
      });
      setAnswers(initialAnswers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete reading");
    } finally {
      setIsCompletingReading(false);
    }
  };

  const submitQuiz = async () => {
    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/lesson/${lessonId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit quiz");
      }

      const data = await response.json();
      setQuizResults(data.results);
      setLesson((prev) => (prev ? { ...prev, status: "completed" } : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit quiz");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const toggleHint = (questionId: string) => {
    setShowHint((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">{error || "Lesson not found"}</p>
        <Button variant="outline" onClick={() => router.push("/lesson-plan")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Lessons
        </Button>
      </div>
    );
  }

  const cefrLevel = numericLevelToCEFR(lesson.targetLevel);

  // Quiz Results View
  if (quizResults || lesson.status === "completed") {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => router.push("/lesson-plan")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Lessons
        </Button>

        <Card className="border-primary">
          <CardHeader className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Award className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Lesson Complete!</CardTitle>
            <CardDescription>{lesson.title}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {quizResults && (
              <>
                {/* Score Display */}
                <div className="text-center">
                  <div
                    className={`inline-flex items-center justify-center h-24 w-24 rounded-full text-3xl font-bold text-white ${
                      quizResults.percentage >= 80
                        ? "bg-green-500"
                        : quizResults.percentage >= 50
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                  >
                    {quizResults.percentage}%
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {quizResults.totalScore}/{quizResults.totalMaxScore} correct
                  </p>
                </div>

                {/* Score Breakdown */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-sm text-muted-foreground">Reading</p>
                    <p className="text-xl font-bold">
                      {quizResults.readingScore}/{quizResults.readingMaxScore}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-sm text-muted-foreground">Vocabulary</p>
                    <p className="text-xl font-bold">
                      {quizResults.vocabularyScore}/{quizResults.vocabularyMaxScore}
                    </p>
                  </div>
                </div>

                {/* XP Earned */}
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">XP Earned</span>
                    <span className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                      +{quizResults.xpAwarded.total} XP
                    </span>
                  </div>
                  <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                    <span>Reading: +{quizResults.xpAwarded.reading}</span>
                    <span>Vocabulary: +{quizResults.xpAwarded.vocabulary}</span>
                  </div>
                </div>

                {/* Level Adjustment */}
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    {quizResults.levelAdjustment === 1 && (
                      <>
                        <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium text-green-600 dark:text-green-400">
                            Great job!
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Your next lesson will be slightly more challenging.
                          </p>
                        </div>
                      </>
                    )}
                    {quizResults.levelAdjustment === -1 && (
                      <>
                        <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                          <TrendingDown className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                          <p className="font-medium text-orange-600 dark:text-orange-400">
                            Keep practicing!
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Your next lesson will reinforce these concepts.
                          </p>
                        </div>
                      </>
                    )}
                    {quizResults.levelAdjustment === 0 && (
                      <>
                        <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <Minus className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-blue-600 dark:text-blue-400">
                            Good work!
                          </p>
                          <p className="text-sm text-muted-foreground">
                            You&apos;re ready for more content at this level.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Question Review */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Question Review</h3>
                  {quizResults.gradedQuestions.map((q, index) => (
                    <div
                      key={q.id}
                      className={`p-4 rounded-lg border ${
                        q.correct
                          ? "bg-green-500/5 border-green-500/20"
                          : "bg-red-500/5 border-red-500/20"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {q.correct ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">
                            {index + 1}. {q.question}
                          </p>
                          {!q.correct && (
                            <div className="mt-2 space-y-1 text-sm">
                              <p className="text-red-600 dark:text-red-400">
                                Your answer: {q.user_answer || "(no answer)"}
                              </p>
                              <p className="text-green-600 dark:text-green-400">
                                Correct answer: {q.correct_answer}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <Button className="w-full" onClick={() => router.push("/lesson-plan")}>
              Start New Lesson
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Quiz View
  if (lesson.status === "quiz" && lesson.quizQuestions) {
    const answeredCount = Object.values(answers).filter((a) => a.length > 0).length;
    const totalQuestions = lesson.quizQuestions.length;
    const progress = (answeredCount / totalQuestions) * 100;

    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Button variant="ghost" onClick={() => router.push("/lesson-plan")}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Lessons
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Quiz: {lesson.title}</CardTitle>
            <CardDescription>
              Answer the questions based on what you read
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {answeredCount}/{totalQuestions} answered
                </span>
              </div>
              <Progress value={progress} />
            </div>

            {/* Questions */}
            <div className="space-y-6">
              {lesson.quizQuestions.map((question, index) => (
                <div key={question.id} className="p-4 rounded-lg border">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-sm font-medium">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">{question.question}</p>
                      {question.context && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {question.context}
                        </p>
                      )}
                    </div>
                  </div>

                  {question.type === "comprehension_mcq" && question.options ? (
                    <div className="space-y-2 ml-9">
                      {question.options.map((option) => (
                        <button
                          key={option}
                          onClick={() => handleAnswerChange(question.id, option)}
                          className={`w-full p-3 rounded-lg border text-left transition-all ${
                            answers[question.id] === option
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="ml-9">
                      <Input
                        placeholder="Type your answer..."
                        value={answers[question.id] || ""}
                        onChange={(e) =>
                          handleAnswerChange(question.id, e.target.value)
                        }
                      />
                    </div>
                  )}

                  {question.hint && (
                    <div className="ml-9 mt-3">
                      <button
                        onClick={() => toggleHint(question.id)}
                        className="text-sm text-primary flex items-center gap-1"
                      >
                        <Lightbulb className="h-3 w-3" />
                        {showHint[question.id] ? "Hide hint" : "Show hint"}
                      </button>
                      {showHint[question.id] && (
                        <p className="text-sm text-muted-foreground mt-1 p-2 rounded bg-muted/50">
                          {question.hint}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={submitQuiz}
              disabled={isSubmitting || answeredCount < totalQuestions}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit Quiz
                  <CheckCircle2 className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Reading View - Use ArticleRenderer
  // Convert lesson data to Content format
  const contentForReader: Content = {
    id: lesson.id,
    title: lesson.title,
    body: lesson.body,
    language: lesson.language,
    difficulty_level: cefrLevel,
    numeric_level: lesson.targetLevel,
    content_type: "article",
    topic_tags: [lesson.topic.id],
    word_count: lesson.wordCount,
    estimated_reading_time: Math.ceil(lesson.wordCount / 200),
    source_url: null,
    is_generated: true,
    created_at: lesson.createdAt,
  };

  return (
    <div className="relative">
      {/* Article Reader */}
      <ArticleRenderer content={contentForReader} isLesson />

      {/* Floating "Finish Reading" Button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <Button
          size="lg"
          onClick={completeReading}
          disabled={isCompletingReading}
          className="shadow-lg"
        >
          {isCompletingReading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Quiz...
            </>
          ) : (
            <>
              <BookOpen className="mr-2 h-4 w-4" />
              I&apos;ve Finished Reading - Take Quiz
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
