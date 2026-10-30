// Urgent news goes to the editor's phone through Telegram (free). Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID as
// GitHub secrets. Without them the Hunter simply sends no alerts.
export function createTelegramAlert({ token, chatId, fetchFn = fetch }) {
  if (!token || !chatId) return null;
  return async function alert({ title, state, source, url, label = "🔴 URGENT" }) {
    const text = `${label} (${state}): ${title}\nSource: ${source}\n${url}\nReview it in the admin: https://www.insightnenews.in/admin/hunter`;
    const res = await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Telegram answered ${res.status}`);
  };
}
