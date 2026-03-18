"use client";

import { useState } from "react";
import { Users, AtSign } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PublicProfile } from "@/types/database";

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

interface SocialProfileGateProps {
  initialDisplayName: string;
  initialUsername?: string | null;
  onSaved: (profile: PublicProfile) => void;
}

export function SocialProfileGate({
  initialDisplayName,
  initialUsername,
  onSaved,
}: SocialProfileGateProps) {
  const supabase = createClient();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [username, setUsername] = useState(initialUsername ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const trimmedDisplayName = displayName.trim();
    const normalizedUsername = username.trim().toLowerCase();

    if (!trimmedDisplayName) {
      setError("Display name is required.");
      return;
    }

    if (!USERNAME_PATTERN.test(normalizedUsername)) {
      setError("Username must be 3-24 characters and use only lowercase letters, numbers, or underscores.");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/social/public-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: normalizedUsername,
          displayName: trimmedDisplayName,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save social profile");
      }

      await supabase.auth.updateUser({
        data: {
          full_name: trimmedDisplayName,
        },
      });

      const savedProfile = (
        payload?.profile ??
        payload?.public_profile ??
        payload?.publicProfile ??
        payload
      ) as PublicProfile;
      onSaved(savedProfile);
      toast.success("Social profile saved");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to save social profile";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users className="size-5" />
          </div>
          <div>
            <CardTitle>Unlock your social workspace</CardTitle>
            <CardDescription>
              Pick a public username so classmates and study partners can find you.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="social-display-name">
              Display name
            </label>
            <Input
              id="social-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="How your friends will see you"
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="social-username">
              Username
            </label>
            <div className="relative">
              <AtSign className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                id="social-username"
                value={username}
                onChange={(event) => setUsername(event.target.value.replace(/\s+/g, "").toLowerCase())}
                className="pl-9"
                placeholder="study_partner"
                disabled={isSaving}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Lowercase letters, numbers, and underscores only.
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">
            Once saved, you can search for friends, accept requests, and start direct chats.
          </p>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save social profile"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
