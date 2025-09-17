import { BskyAgent } from '@atproto/api';

const HIRA = [...'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'];
const rand3 = () =>
  Array.from({ length: 3 }, () => HIRA[Math.floor(Math.random() * HIRA.length)]).join('');

// 日替わり固定にしたい場合は上のrand3を使わず、下のdaily3ByDateJSTを使ってOK
function daily3ByDateJST() {
  const now = new Date();
  const y = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric' }).format(now);
  const m = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit' }).format(now);
  const d = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', day: '2-digit' }).format(now);
  let seed = 0;
  for (const c of `${y}${m}${d}`) seed = (seed * 131 + c.charCodeAt(0)) >>> 0;
  const pick = () => HIRA[(seed = (seed * 1664525 + 1013904223) >>> 0) % HIRA.length];
  return pick() + pick() + pick();
}

const agent = new BskyAgent({ service: 'https://bsky.social' });
await agent.login({
  identifier: process.env.BSKY_HANDLE,
  password: process.env.BSKY_APP_PASSWORD
});

const text = rand3(); // ← “その日固定”にしたいなら daily3ByDateJST() に変更
await agent.post({ text });
console.log('posted:', text);
