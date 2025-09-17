import { TwitterApi } from 'twitter-api-v2';

// ===== 星座（日本語かな + 期間） =====
const SIGNS = [
  { name: 'おひつじ座', range: '3/21~4/19' },
  { name: 'おうし座',   range: '4/20~5/20' },
  { name: 'ふたご座',   range: '5/21~6/21' },
  { name: 'かに座',     range: '6/22~7/22' },
  { name: 'しし座',     range: '7/23~8/22' },
  { name: 'おとめ座',   range: '8/23~9/22' },
  { name: 'てんびん座', range: '9/23~10/23' },
  { name: 'さそり座',   range: '10/24~11/22' },
  { name: 'いて座',     range: '11/23~12/21' },
  { name: 'やぎ座',     range: '12/22~1/19' },
  { name: 'みずがめ座', range: '1/20~2/18' },
  { name: 'うお座',     range: '2/19~3/20' },
];

// ===== 一言フレーズ（各20） =====
const GOOD = [
  '一歩前進','追い風','光が差す','手応えあり','注目の的',
  '運命的','波に乗る','願い近づく','ご褒美日','笑顔が鍵',
  '快調','突破口','整う','会話◎','直感冴える',
  'ベストタイミング','ツキあり','はかどる','チャンス到来','縁がつながる',
];

const MID = [
  '準備万端','整える日','落ち着いて','段取り優先','聞き役で',
  '丁寧さ大事','足元固め','マイペース','情報整理','早寝早起き',
  '深呼吸','ほどほどに','様子見','習慣化','基本確認',
  '小さく試す','淡々と','連絡は早め','感謝を一言','優先順位決め',
];

const LOW = [
  '無理しない','焦らずに','休息優先','体をいたわる','ペース配分',
  '深呼吸で整う','確認を丁寧に','早めに切り上げ','やさしく話す','水分補給',
  '短く終える','一人時間を確保','背伸びはしない','柔らかく受け止め','温かくする',
  '足元に注意','寄り道はほどほど','簡単な方を選ぶ','今日は守り','笑顔を忘れず',
];

// ===== ユーティリティ =====
const TZ = 'Asia/Tokyo';
function ymdJST() {
  const now = new Date();
  const y = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric' }).format(now);
  const m = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, month: '2-digit' }).format(now);
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, day: '2-digit' }).format(now);
  return { y, m, d, key: `${y}${m}${d}`, label: `${y}/${m}/${d}` };
}
function rng(seed){ return ()=>{ seed = (seed*1664525 + 1013904223)>>>0; return seed/2**32; }; }
function shuffleDay(arr, seedKey){
  const r = rng([...seedKey].reduce((a,c)=>((a*131 + c.charCodeAt(0))>>>0), 0));
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){ const j = Math.floor(r()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; }
  return a;
}
function phraseForRank(rankIdx, r){
  const pick = (list)=> list[Math.floor(r()*list.length)];
  if (rankIdx <= 2) return pick(GOOD);     // 1〜3位
  if (rankIdx <= 8) return pick(MID);      // 4〜9位（少し広めに）
  return pick(LOW);                         // 10〜12位
}

// ランキング本文（280字内に収まる想定）
function buildRankingTweet(){
  const { key, label } = ymdJST();
  const r = rng([...key].reduce((a,c)=>((a*131 + c.charCodeAt(0))>>>0), 0));
  const order = shuffleDay(SIGNS, key); // その日固定の順番

  const head = `【12星座ランキング｜${label}】`;
  const lines = order.map((s, i) => {
    const phrase = phraseForRank(i, r);
    // 希望の表示形式：1位 〇〇座 一言
    return `${i+1}位 ${s.name} ${phrase}`;
  });

  // 足りなければタグを付けてOK（長さに余裕があれば）
  const body = [head, ...lines].join('\n');
  if (body.length <= 270) return body + '\n#12星座占い #今日の運勢';
  return body;
}

// 星座と期間の表を返信で（行数が多いのでスレッドに回す）
function buildRangesReply(){
  const { label } = ymdJST();
  const lines = SIGNS.map(s => `${s.name}（${s.range}）`);
  return [`星座と期間｜${label}`, ...lines].join('\n');
}

// ===== メイン =====
async function main(){
  const client = new TwitterApi({
    appKey: process.env.X_APP_KEY,
    appSecret: process.env.X_APP_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET,
  });

  const text = buildRankingTweet();

  // ① ランキングを投稿（同日再実行の重複=403はスキップ）
  let rootId = null;
  try {
    const res = await client.v2.tweet(text);
    rootId = res.data.id;
    console.log('tweeted horoscope');
  } catch (e) {
    const dup = e?.data?.detail && String(e.data.detail).includes('duplicate');
    if (dup) { console.log('duplicate; skip'); return; }
    throw e;
  }

  // ② 星座と期間の一覧をリプライで投稿（情報要望対応）
  try {
    const reply = buildRangesReply();
    await client.v2.tweet({ text: reply, reply: { in_reply_to_tweet_id: rootId } });
    console.log('posted ranges reply');
  } catch (e) {
    console.error('reply failed:', e?.data ?? e?.message ?? e);
  }
}
await main();
