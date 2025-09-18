import { TwitterApi } from 'twitter-api-v2';

// 英小文字3文字（重複なし）
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
function randomAlpha3Distinct() {
  const pick = () => LETTERS[Math.floor(Math.random() * LETTERS.length)];
  let a = pick(), b = pick(), c = pick();
  while (b === a) b = pick();
  while (c === a || c === b) c = pick();
  return a + b + c;
}

// ピン留め（REST直叩き）
async function pinTweetById(client, userId, tweetId) {
  let pinned;
  try {
    const meDetail = await client.v2.user(userId, { 'user.fields': 'pinned_tweet_id' });
    pinned = meDetail.data?.pinned_tweet_id;
  } catch {}
  if (pinned && pinned !== tweetId) {
    try { await client.v2.delete(`users/${userId}/pinned_tweets/${pinned}`); } catch {}
  }
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

  const text = randomAlpha3Distinct();

  // 自分のユーザーID
  const me = await client.v2.me();
  const userId = me.data.id;

  // 投稿（重複403は既存をピンに切替）
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
      const tl = await client.v2.userTimeline(userId, { max_results: 10, exclude: ['replies','retweets'] });
      const hit = tl.tweets?.find(t => t.text === text);
      if (!hit) { console.log('existing tweet not found; skip pin.'); return; }
      newId = hit.id;
      console.log('found existing tweet id:', newId);
    } catch (er) {
      console.error('timeline fetch failed:', er?.data ?? er?.message ?? er);
      return;
    }
  }

  await pinTweetById(client, userId, newId);
}

await main();
