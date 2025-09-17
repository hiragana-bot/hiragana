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

/**
 * 3文字すべて異なる & 日替わり一意（重複なし）
 * N*(N-1)*(N-2) 通りの順列に日数を1対1で対応させる。
 */
function dailyUnique3Distinct() {
  const N = HIRA.length;
  const P = N * (N - 1) * (N - 2); // 全順列数
  const A = 11, B = 13;            // 擬似シャッフル係数（Pと互いに素）

  let x = (A * (jstDayIndex() % P) + B) % P;

  // 混合基数で重複なしに展開
  const i0 = x % N;                      x = Math.floor(x / N);
  let i1 = x % (N - 1);                  x = Math.floor(x / (N - 1));
  if (i1 >= i0) i1 += 1;                 // i0 を飛ばす
  let i2 = x % (N - 2);
  const a = Math.min(i0, i1), b = Math.max(i0, i1);
  if (i2 >= a) i2 += 1;
  if (i2 >= b) i2 += 1;

  return HIRA[i0] + HIRA[i1] + HIRA[i2];
}

async function main() {
  const client = new TwitterApi({
    appKey: process.env.X_APP_KEY,
    appSecret: process.env.X_APP_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  });

  // ← これが抜けていた！
  const text = dailyUnique3Distinct();    // その日固定・3文字すべて異なる

  // 投稿
  const res = await client.v2.tweet(text);
  const newId = res.data.id;
  console.log('tweeted:', text);

  // 自分のユーザーID取得
  const me = await client.v2.me();
  const userId = me.data.id;

  // 旧ピンを取得（pinned_tweet_idのために詳細取得）
  let pinned;
  try {
    const meDetail = await client.v2.user(userId, { 'user.fields': 'pinned_tweet_id' });
    pinned = meDetail.data?.pinned_tweet_id;
  } catch (_) {}

  // 旧ピン解除（失敗は無視）
  if (pinned && pinned !== newId) {
    try {
      await client.v2.delete(`users/${userId}/pinned_tweets/${pinned}`);
    } catch (_) {}
  }

  // 新しいツイートをピン留め（失敗はログだけ）
  try {
    await client.v2.post(`users/${userId}/pinned_tweets`, { tweet_id: newId });
    console.log('pinned:', newId);
  } catch (e) {
    console.error('failed to pin:', e?.data ?? e?.message ?? e);
  }
}

await main();
