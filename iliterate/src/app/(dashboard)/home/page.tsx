import Link from "next/link";
import {
  BookOpen,
  Layers,
  HelpCircle,
  Settings,
  Users,
} from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    title: "Library",
    description: "Browse content in your target language",
    href: "/library",
    icon: BookOpen,
  },
{
    title: "Flashcards",
    description: "Review your saved vocabulary",
    href: "/flashcards",
    icon: Layers,
  },
  {
    title: "Quizzes",
    description: "Test your knowledge",
    href: "/quizzes",
    icon: HelpCircle,
  },
  {
    title: "Social",
    description: "Find study partners and chat with friends",
    href: "/social",
    icon: Users,
  },
  {
    title: "Settings",
    description: "View your profile and preferences",
    href: "/profile",
    icon: Settings,
  },
];

export default function HomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Home</h1>
      <p className="text-muted-foreground mt-2">
        What would you like to do today?
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Link key={feature.href} href={feature.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
                    <feature.icon className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      {feature.title}
                    </CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
