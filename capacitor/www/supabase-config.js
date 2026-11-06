// Возьмите URL и publishable/anon key в Supabase → Project Settings → API.
// Публичный anon key безопасно хранить в клиенте ТОЛЬКО при включённом RLS.
export default {
  url: 'https://YOUR_PROJECT.supabase.co',
  anonKey: 'PASTE_SUPABASE_ANON_KEY',
  vapidPublicKey: '' // Заполняется только при подключении серверного Web Push
};
