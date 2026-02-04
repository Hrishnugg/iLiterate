-- Sample Japanese content for testing the reader
INSERT INTO content (title, body, language, difficulty_level, content_type, topic_tags, word_count, estimated_reading_time, is_generated)
VALUES (
  '日本の四季',
  '日本には四つの季節があります。春、夏、秋、冬です。

春は三月から五月までです。桜の花が咲きます。多くの人々が公園でお花見をします。天気は暖かくなります。

夏は六月から八月までです。とても暑いです。子供たちは夏休みがあります。海やプールで泳ぎます。花火大会もあります。

秋は九月から十一月までです。紅葉がきれいです。涼しくなります。美味しい果物がたくさんあります。りんご、柿、ぶどうなどです。

冬は十二月から二月までです。寒いです。雪が降る地域もあります。お正月は一月一日です。家族と一緒に過ごします。

日本の四季はとても美しいです。それぞれの季節に特別な行事や食べ物があります。',
  'japanese',
  'A2',
  'article',
  ARRAY['culture', 'seasons', 'japan'],
  150,
  3,
  false
);

-- Another sample - a simple dialogue
INSERT INTO content (title, body, language, difficulty_level, content_type, topic_tags, word_count, estimated_reading_time, is_generated)
VALUES (
  'カフェでの会話',
  '田中：すみません。

店員：いらっしゃいませ。何になさいますか？

田中：コーヒーをお願いします。

店員：ホットですか、アイスですか？

田中：ホットでお願いします。

店員：サイズはいかがなさいますか？S、M、Lがございます。

田中：Mサイズでお願いします。

店員：かしこまりました。お席でお待ちください。

田中：ありがとうございます。

（数分後）

店員：お待たせいたしました。ホットコーヒーのMサイズです。

田中：ありがとうございます。おいくらですか？

店員：四百五十円になります。

田中：はい、五百円でお願いします。

店員：五十円のお返しです。ありがとうございました。',
  'japanese',
  'A1',
  'dialogue',
  ARRAY['conversation', 'cafe', 'daily-life'],
  100,
  2,
  false
);
