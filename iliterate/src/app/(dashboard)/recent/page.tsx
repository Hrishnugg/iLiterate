export default function RecentFlashCardsPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Recently Added</h1>
        <p className="text-muted-foreground mt-2">
          See flashcards recently added from your books.
        </p>
      </div>
      
      {contents && contents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contents.map((content: { id: Key | null | undefined; title: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; language: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; content_type: string | number | bigint | boolean | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<string | number | bigint | boolean | ReactPortal | ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined; topic_tags: string[]; }) => (
            <Card key={content.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{content.title}</CardTitle>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <span className="capitalize">{content.language}</span>
                  <span>•</span>
                  <span>{content.content_type}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-end">
                {content.topic_tags && content.topic_tags.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-1">
                    {content.topic_tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <Button asChild className="w-full">
                  <Link href={`/flashcards/${content.id}`}> 
                    Study
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="mt-4 text-lg font-semibold">No decks yet</h3>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Save words while reading to create a deck of flashcards.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}