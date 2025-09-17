import { TwitterApi } from 'twitter-api-v2';

// 小文字アルファベット3文字を完全ランダム（NGなし）
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
function randomAlpha3() {
  let s = '';
  for (let i = 0; i < 3; i++) {
    s += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }
  return s;
}

// ピン留め（v2のRESTを直接叩く）
async function pinTweetById(client, userId, tweetId) {
  // 現ピン取得
  let pinned;
  try {
    const meDetail = await client.v2.user(userId, { 'user.fields': 'pinned_tweet_id' });
    pinned = meDetail.data?.pinned_tweet_id;
  } catch (_) {}

  // 旧ピン解除（あれば）
  if (pinned && pinned !== tweetId) {
    try { await client.v2.delete(`users/${userId}/pinned_tweets/${pinned}`); } catch (_) {}
  }
  // 新規ピン
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

  const text = randomAlpha3();

  // 自分のユーザーID
  const me = await client.v2.me();
  const userId = me.data.id;

  // 投稿（同日同文で403なら既存をピンに回す）
  let newId = null;
  try {
    const res = await client.v2.tweet(text);
    newId = res.data.id;
    console.log('tweeted:', text);
  } catch (e) {
    const dup = e?.data?.detail && String(e.data.detail).includes('duplicate');
    if (!dup) throw e;

    console.log('duplicate detected, searching existing tweet…');
    try {
      const tl = await client.v2.userTimeline(userId, { max_results: 10, exclude: ['replies', 'retweets'] });
      const hit = tl.tweets?.find(t => t.text === text);
      if (!hit) { console.log('existing tweet not found; skip pin.'); return; }
      newId = hit.id;
      console.log('found existing tweet id:', newId);
    } catch (er) {
      console.error('timeline fetch failed:', er?.data ?? er?.message ?? er);
      return;
    }
  }

  // ピン留め
  await pinTweetById(client, userId, newId);
}

await main();
