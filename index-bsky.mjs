import { TwitterApi } from 'twitter-api-v2';

/** 濁点・半濁点を含むひらがな（小書き文字は除外） */
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
  'ゔ'               // う゛（ゔ）も対象
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
 * 3文字すべて異なる & 日替わり一意
 * N個から重複なし順列（N*(N-1)*(N-2) 通り）に 1対1対応させる。
 */
function dailyUnique3Distinct() {
  const N = HIRA.length;
  const P = N * (N - 1) * (N - 2);       // 全順列数（3文字・重複なし）
  // 擬似シャッフル（線形合同）で見た目を散らす（A は P と互いに素）
  const A = 11, B = 13;
  let x = (A * (jstDayIndex() % P) + B) % P;

  // 混合基数で 3 インデックスへ（重複なしに展開）
  const i0 = x % N;                      x = Math.floor(x / N);
  let i1 = x % (N - 1);                  x = Math.floor(x / (N - 1));
  if (i1 >= i0) i1 += 1;                 // i0 を飛ばす
  let i2 = x % (N - 2);
  // i0, i1 を飛ばす
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

  const text = dailyUnique3Distinct();    // その日固定・3文字すべて異なる

  // 投稿
  const res = await client.v2.tweet(text);
  const newId = res.data.id;
  console.log('tweeted:', text);

  // 最新をピン留め（前日分があれば外す）
  const me = await client.v2.me({ 'user.fields': 'pinned_tweet_id' });
  const userId = me.data.id;
  const pinned = me.data.pinned_tweet_id;
  if (pinned && pinned !== newId) {
    try { await client.v2.unpinTweet(userId, pinned); } catch { /* 既に外れている等は無視 */ }
  }
  await client.v2.pinTweet(userId, newId);
  console.log('pinned:', newId);
}

await main();
