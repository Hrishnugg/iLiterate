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
import { Book, Plus } from "lucide-react";


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
          <CardTitle className="text-lg">View All Flashcards
          </CardTitle>
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
          <CardTitle className="text-lg">Sorted By Book</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p>
            Review defined words from your books.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
              <Link href = "/recent">
                View Sorted By Book
              </Link>
          </Button>
        </CardFooter>
      </Card>
      </div>
    </div>
  );
}

