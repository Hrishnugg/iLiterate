# Reader Test Notes

This folder now includes three higher-level eReader tests that cover the main state-changing paths we added around the HTML/article reader.

## 1. `ArticleRenderer.test.tsx`

This is the orchestration test for the full reader page shell.

What it checks:
- initial data hydration for highlights, recent lookups, and saved flashcard terms
- translating a text selection and sending the right request payload
- lesson-mode translation using `lessonId` instead of `contentId`
- saving a note, reloading highlights, and clearing the active selection
- saving a word to flashcards and preventing duplicate lookup-to-flashcard adds
- clearing/removing lookups from the sidebar
- focusing a highlight, opening the right panel, deleting a highlight, and returning to the saved reading position

Why it exists:
- `ArticleRenderer` owns the fetch calls and state updates that tie the reader together, so this file verifies that the major reader mutations work as one flow instead of only as isolated unit tests.

## 2. `ContentRenderer.test.tsx`

This is the DOM-behavior test for rendered article content.

What it checks:
- saved highlights render into the processed HTML as `<mark>` elements
- the current live selection also renders into the article body
- clicking a rendered highlight returns the correct highlight object
- text selection offsets and context are calculated against the whole content container, not just a single paragraph or node

Why it exists:
- the rest of the reader depends on `ContentRenderer` producing stable DOM annotations and accurate selection metadata, so this test protects the text/highlight plumbing directly.

## 3. `ReadingStats.test.tsx`

This is the interaction test for reader progress controls.

What it checks:
- clicking and dragging the progress bar emits clamped seek percentages
- non-interactive mode ignores pointer input
- completed progress shows the completed copy and badge

Why it exists:
- `ReadingStats` is small, but it contains the drag logic for interactive seeking in reader modes like RSVP, so this test keeps the progress mutation behavior from silently regressing.

## Running These Tests

From the project root:

```powershell
cd "C:\Users\hrish\Code Projects\CSDS393Project\iliterate"
npm run test:reader
```

If you want to inspect only one file:

```powershell
npx vitest run src/components/reader/__tests__/ArticleRenderer.test.tsx
npx vitest run src/components/reader/__tests__/ContentRenderer.test.tsx
npx vitest run src/components/reader/__tests__/ReadingStats.test.tsx
```
