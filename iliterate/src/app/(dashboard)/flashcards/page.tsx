import { Button } from "@/components/ui/button"
import Link from "next/link";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Plus } from "lucide-react";


export default function FlashcardsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Flashcards</h1>
      <p className="text-muted-foreground mt-2">
        Review your saved vocabulary.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
          <CardTitle className="text-lg">View Flashcards</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p>
            Look at all the new words you've learned so far!
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href = "/all">
              View All
            </Link>
          </Button>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
          <CardTitle className="text-lg">Recently Added</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p>
            Review recently defined words from your books.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
              <Link href = "/recent">
                View Recently Added
              </Link>
          </Button>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
          <CardTitle className="text-lg">Create New Flashcard</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p>
            Create your own flashcard for a term!
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href = "/create">
              <Plus/>
              Create
            </Link>
          </Button>
        </CardFooter>
      </Card>
      </div>
    </div>
  );
}

