import { Button } from "@/components/ui/button"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Link } from "lucide-react";


export default function FlashcardsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Flashcards</h1>
      <p className="text-muted-foreground mt-2">
        Review your saved vocabulary.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>View Flashcards</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
              <Link href={`/All`}>
                  View all
              </Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recently Added</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
              <Link href={`/Recent`}>
                  View recently added
              </Link>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Create New Flashcard</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
              <Link href={`/Create`}>
                  Create
              </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

