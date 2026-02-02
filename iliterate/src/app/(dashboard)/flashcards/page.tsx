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
          <Button type = "submit" className="w-full">View All Flashcards</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recently Added</CardTitle>
        </CardHeader>
        <CardContent>
          <Button type = "submit" className="w-full">View Recently Added</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Create New Flashcard</CardTitle>
        </CardHeader>
        <CardContent>
          <Button type = "submit" className="w-full">Create New</Button>
        </CardContent>
      </Card>
    </div>
  );
}

