"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ClipboardCheck, BookOpen, CheckCircle2 } from "lucide-react";

interface PendingQuiz {
  id: string;
  title: string;
  difficulty_level: string;
  progress_percent: number;
}

interface CompletedQuiz {
  id: string;
  content_id: string;
  content_title: string;
  score_percent: number;
  total_xp: number;
  created_at: string;
}

export default function QuizzesPage() {
  const [pendingQuizzes, setPendingQuizzes] = useState<PendingQuiz[]>([]);
  const [completedQuizzes, setCompletedQuizzes] = useState<CompletedQuiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchQuizzes() {
      try {
        const response = await fetch("/api/quizzes");
        if (response.ok) {
          const data = await response.json();
          setPendingQuizzes(data.pending || []);
          setCompletedQuizzes(data.completed || []);
        }
      } catch (error) {
        console.error("Failed to fetch quizzes:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchQuizzes();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Quizzes</h1>
        <p className="text-muted-foreground mt-1">
          Test your comprehension and earn XP
        </p>
      </div>

      {/* Pending Quizzes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Ready to Take
          </CardTitle>
          <CardDescription>
            Complete these quizzes to earn XP for content you&apos;ve read
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingQuizzes.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                No quizzes available yet. Read some content from the Library to unlock quizzes!
              </p>
              <Button asChild className="mt-4">
                <Link href="/library">Go to Library</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingQuizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{quiz.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {quiz.difficulty_level} • {quiz.progress_percent}% read
                    </p>
                  </div>
                  <Button asChild>
                    <Link href={`/quizzes/${quiz.id}`}>Take Quiz</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed Quizzes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Completed
          </CardTitle>
          <CardDescription>Your quiz history</CardDescription>
        </CardHeader>
        <CardContent>
          {completedQuizzes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No completed quizzes yet
            </p>
          ) : (
            <div className="space-y-3">
              {completedQuizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold ${
                        quiz.score_percent >= 70
                          ? "bg-green-500"
                          : quiz.score_percent >= 50
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                    >
                      {quiz.score_percent}%
                    </div>
                    <div>
                      <p className="font-medium">{quiz.content_title}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(quiz.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-yellow-600 dark:text-yellow-400">
                      +{quiz.total_xp} XP
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
