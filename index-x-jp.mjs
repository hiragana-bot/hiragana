import { TwitterApi } from 'twitter-api-v2';

/** 濁点・半濁点を含むひらがな（小書きは除外） */
const HIRA = [...(
  'あいうえお' +
  'かきくけこ' + 'がぎぐげご' +
  'さしすせそ' + 'ざじずぜぞ' +
  'たちつてと' + 'だぢづでど' +
  'なにぬねの' +
  'はひふへほ' + 'ばびぶべぼ' + 'ぱぴぷぺぽ' +
  'まみむめも' +
  'やゆよ' +
  'らりるれろ' +
  'わをん' +
  'ゔ'
)];

/** JSTの“日インデックス”（開始日からの経過日） */
function jstDayIndex() {
  const tz = 'Asia/Tokyo';
  const now = new Date();
  const y = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric' }).format(now);
  const m = new Intl.DateTimeFormat('en-CA', { timeZone: tz, month: '2-digit' }).format(now);
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: tz, day: '2-digit' }).format(now);
  const todayJst = new Date(`${y}-${m}-${d}T00:00:00+09:00`);
  const startJst = new Date(`2025-01-01T00:00:00+09:00`);
  return Math.floor((todayJst.getTime() - startJst.getTime()) / 86_400_000);
}

/** 3文字すべて異なる & 日替わり一意（重複なし） */
function dailyUnique3Distinct() {
  const N = HIRA.length;
  const P = N * (N - 1) * (N - 2);
  const A = 11, B = 13;                   // 見た目シャッフル
  let x = (A * (jstDayIndex() % P) + B) % P;

  const i0 = x % N;                      x = Math.floor(x / N);
  let i1 = x % (N - 1);                  x = Math.floor(x / (N - 1));
  if (i1 >= i0) i1 += 1;
  let i2 = x % (N - 2);
  const a = Math.min(i0, i1), b = Math.max(i0, i1);
  if (i2 >= a) i2 += 1;
  if (i2 >= b) i2 += 1;

  return HIRA[i0] + HIRA[i1] + HIRA[i2];
}

async function pinTweetById(client, userId, tweetId) {
  // 既存ピン取得
  let pinned;
  try {
    const meDetail = await client.v2.user(userId, { 'user.fields': 'pinned_tweet_id' });
    pinned = meDetail.data?.pinned_tweet_id;
  } catch (_) {}

  // 旧ピン解除
  if (pinned && pinned !== tweetId) {
    try { await client.v2.delete(`users/${userId}/pinned_tweets/${pinned}`); } catch (_) {}
  }
  // 新ピン
  try {
    await client.v2.post(`users/${userId}/pinned_tweets`, { tweet_id: tweetId });
    console.log('pinned:', tweetId);
  } catch (e) {
    console.error('failed to pin:', e?.data ?? e?.message ?? e);
  }
}

async function main() {
  const client = new TwitterApi({
    appKey: process.env.X_APP_KEY,
    appSecret: process.env.X_APP_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  });

  const text = dailyUnique3Distinct();

  // ユーザーID取得（重複時のフォールバックで使う）
  const me = await client.v2.me();
  const userId = me.data.id;

  let newId = null;
  try {
    // 通常は投稿
    const res = await client.v2.tweet(text);
    newId = res.data.id;
    console.log('tweeted:', text);
  } catch (e) {
    const dup = e?.data?.detail && String(e.data.detail).includes('duplicate');
    if (!dup) throw e; // 別エラーはそのまま投げる

    console.log('duplicate detected, searching existing tweet…');
    // 直近のツイートから同文を探す（読取は極力少なく）
    try {
      const tl = await client.v2.userTimeline(userId, { max_results: 10, exclude: ['replies', 'retweets'] });
      const hit = tl.tweets?.find(t => t.text === text);
      if (hit) {
        newId = hit.id;
        console.log('found existing tweet id:', newId);
      } else {
        console.log('existing tweet not found; skip pin.');
        return;
      }
    } catch (er) {
      console.error('timeline fetch failed:', er?.data ?? er?.message ?? er);
      return;
    }
  }

  // ピン留め処理
  await pinTweetById(client, userId, newId);
}

await main();
