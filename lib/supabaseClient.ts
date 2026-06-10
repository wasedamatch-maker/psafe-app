// lib/supabaseClient.ts
// ブラウザ用 Supabase クライアント（クライアントコンポーネントから使う前提）。
// 匿名ユーザのセッションを端末に保持して、自己履歴を同一人物として紐づける。
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("Supabase env vars が未設定です（.env.local を確認）");
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,    // 同じ端末で匿名ユーザを保持（履歴の継続に必須）
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// 注: これはブラウザ向けの素のクライアント。将来サーバコンポーネント/SSRで
//     セッションを扱うなら @supabase/ssr に切り替える。今回のUIはクライアント主体なのでこれで十分。
