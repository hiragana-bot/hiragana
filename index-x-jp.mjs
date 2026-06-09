import { TwitterApi } from 'twitter-api-v2';
// ① 楽天で売れ筋を1件取得（2026年新仕様）
async function fetchRakutenItem(genreId) {
  const params = new URLSearchParams({
    applicationId: process.env.RAKUTEN_APP_ID,
    accessKey: process.env.RAKUTEN_ACCESS_KEY,   // ← 新仕様で必須
    affiliateId: process.env.RAKUTEN_AFFILIATE_ID,
    genreId: genreId,
    page: '1',
    format: 'json',
    formatVersion: '2',
  });
  // ← 新ドメイン・新パス
  const url = `https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601?${params}`;
  const res = await fetch(url, {
    headers: {
      'Referer': 'https://www.rakuten.co.jp/',
      'Origin': 'https://www.rakuten.co.jp',
      'User-Agent': 'Mozilla/5.0',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Rakuten API ${res.status}: ${body}`);
  }
  const data = await res.json();
  // formatVersion:2 だと Items が直接配列
  const items = (data.Items || []).slice(0, 10);
  if (items.length === 0) throw new Error('No items returned');
  const item = items[Math.floor(Math.random() * items.length)];
  return {
    name: item.itemName,
    price: item.itemPrice,
    reviewCount: item.reviewCount,
    reviewAverage: item.reviewAverage,
    url: item.affiliateUrl || item.itemUrl,
  };
}
// 先頭の【...】を全部除去して読みやすくする
function cleanItemName(name) {
  return name.replace(/^(?:【[^】]*】\s*)+/, '').trim();
}
function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
function buildText(item) {
  const star = item.reviewAverage ? `★${item.reviewAverage}（${item.reviewCount}件）` : '';
  const name = truncate(cleanItemName(item.name), 50);
  return `【PR】楽天で人気の商品✨\n${name}\n${item.price.toLocaleString()}円 ${star}\n${item.url}\n#楽天市場 #PR`;
}
async function main() {
  const client = new TwitterApi({
    appKey: process.env.X_APP_KEY,
    appSecret: process.env.X_APP_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  });
  const GENRE_ID = process.env.RAKUTEN_GENRE_ID || '0'; // 0=総合
  const item = await fetchRakutenItem(GENRE_ID);
  const text = buildText(item);
  const res = await client.v2.tweet(text);
  console.log('tweeted:', res.data.id, '\n', text);
}
await main();
