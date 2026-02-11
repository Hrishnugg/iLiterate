"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { QuizContainer } from "@/components/quiz/QuizContainer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

interface ContentInfo {
  id: string;
  title: string;
  difficulty_level: string;
}

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;
  const [content, setContent] = useState<ContentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchContent() {
      try {
        const response = await fetch(`/api/content/${contentId}`);
        if (response.ok) {
          const data = await response.json();
          setContent(data);
        }
      } catch (error) {
        console.error("Failed to fetch content info:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (contentId) {
      fetchContent();
    }
  }, [contentId]);

  const handleComplete = () => {
    router.push("/progress");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Quiz</h1>
          {content && (
            <p className="text-muted-foreground">{content.title}</p>
          )}
        </div>
      </div>

      <QuizContainer
        contentId={contentId}
        contentTitle={content?.title}
        onComplete={handleComplete}
      />
    </div>
  );
}
