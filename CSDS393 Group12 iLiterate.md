Project Name  
iLiterate 

Group Members

- Ethan Fang (ewf22)  
- Hrishi Hari (hxh644)  
- Curtis Li (cxl1503)  
- Anthony Retelewski (avr58)

Problem  
When learning languages, sometimes we encounter times where we struggle to read text/article/passage because of a few characters/phrases that we are unfamiliar with. This makes it extremely difficult to get through full new articles, books, etc. and makes the task seem very daunting.

Proposal  
What if there were a way to read authentic content in a new language without that friction? A platform where learners can read texts at their appropriate level and instantly highlight any unfamiliar word, character, or phrase to see its English translation, pronunciation, and definition without leaving the page.

We can also turn those highlighted unknown words into flashcards (anki, quizlet) where users can practice using spaced repetition and context-based exercises. As users read more, our application adapts and learns what users struggle with and recommend new content that is challenging but still approachable (all of this can be done dynamically using LLMs). 

Instead of memorizing isolated vocabulary (duolingo), users acquire language naturally through context, repetition, and meaningful reading.

Flow  
When a user first signs up, they select the language they want to learn. From there, they complete a short onboarding questionnaire that collects key information: their native language, age, highest level of education completed, and how many years (if any) they've spent learning their target language. Most importantly, we ask users why they want to learn—whether for travel, career advancement, academic study, or personal interest. This motivation data is critical because it allows us to tailor content recommendations to each user's specific goals. Based on their responses, users are placed into an appropriate proficiency bucket, ranging from elementary (K-12 equivalents) to college-level and career-specific terminology. Once onboarded, the application automatically generates customized course content that matches the user's background, experience, and learning objectives.

Outside of the course content, we plan to include a few other features to support the user’s language learning experience.

Features

1) Course Content  
   1) Based on user context (background, experience, motivation), our application will create customized content for the user.  
2) Flashcards  
   1) With the course content, the user should be able to select terms/phrases that they are unfamiliar with, which automatically creates flashcards for the user to practice. We plan to take inspiration from Anki/Quizlet for this feature.  
3) Knowledge checks  
   1) Short quizzes after reading/flashcards to test whether the user actually understands material.  
4) Text in context  
   1) The app presents real-world examples of the written language (signs, menus, etc.) to familiarize users with how the language appears in real life (Perplexity)..   
5) Image (media) to word OCR  
   1) Users can upload images with text to the app, the app extracts the text and uses it as content for the user  
6) Words per minute (WPM) reader  
   1) To practice rapidity in recognizing words or phrases, users can adjust the wpm shown to them   
7) Streaks  
   1) Keeps track of when users started learning and how many days in a row they keep using the app to learn, taking inspiration from GitHub commit logs.  
8) Group convo (advanced?)  
   1) Users can practice texting (speaking?) with other users in the language that they are learning. Could introduce auto-translation of messages to display messages per user in the language that they are learning. Enable people to send messages in different languages.

Planned Languages / Frameworks

- Host frontend on Vercel  
  - [Next.js](http://Next.js)  
  - UI Inspiration:  
    - EReaders: Moon+ Reader, Lithium  
    - Notion  
    - Shadcn components  
- Backend:  
  - Python  
- Database:  
  - Supabase  
- Translation / LLM:  
  - TranslateGemma  
  - Gemini  
- OCR:  
  - Gemini