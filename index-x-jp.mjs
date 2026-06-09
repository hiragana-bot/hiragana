import { TwitterApi } from 'twitter-api-v2';

// ① 楽天で売れ筋を1件取得
async function fetchRakutenItem(genreId) {
  const appId = process.env.RAKUTEN_APP_ID;
  const affId = process.env.RAKUTEN_AFFILIATE_ID;
  const url = `https://app.rakuten.co.jp/services/api/IchibaItem/Ranking/20220601`
    + `?applicationId=${appId}&affiliateId=${affId}&genreId=${genreId}&page=1`;
  const res = await fetch(url);
  const data = await res.json();
  // ランキング上位からランダムに1件（毎日同じにならないように）
  const items = data.Items.slice(0, 10);
  const item = items[Math.floor(Math.random() * items.length)].Item;
  return {
    name: item.itemName,
    price: item.itemPrice,
    reviewCount: item.reviewCount,
    reviewAverage: item.reviewAverage,
    url: item.affiliateUrl || item.itemUrl, // アフィリンク
  };
}

// ② 投稿文を生成（AIキーが無ければテンプレにフォールバック）
async function buildText(item) {
  if (process.env.ANTHROPIC_API_KEY) {
    // ここをAI生成に差し替え（後述）
  }
  // テンプレ版（まずこれで動かす）
  const star = item.reviewAverage ? `★${item.reviewAverage}（${item.reviewCount}件）` : '';
  return `【楽天で人気】${truncate(item.name, 60)}\n${item.price.toLocaleString()}円 ${star}\n${item.url}`;
}

function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }

async function main() {
  const client = new TwitterApi({
    appKey: process.env.X_APP_KEY,
    appSecret: process.env.X_APP_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  });

  const GENRE_ID = process.env.RAKUTEN_GENRE_ID || '0'; // 0=総合ランキング
  const item = await fetchRakutenItem(GENRE_ID);
  const text = await buildText(item);

  const res = await client.v2.tweet(text);
  console.log('tweeted:', res.data.id, text);
}

await main();
