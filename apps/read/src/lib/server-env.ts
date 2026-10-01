import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export const serverEnv = {
  serviceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  telegramBotToken: () => process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramAdminChatId: () => process.env.TELEGRAM_ADMIN_CHAT_ID ?? "",
  adminTelegramIds: () => process.env.ADMIN_TELEGRAM_IDS ?? "",
  telegramWebhookSecret: () => process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
  bank: () => ({
    name: process.env.BANK_NAME ?? "",
    accountNumber: process.env.BANK_ACCOUNT_NUMBER ?? "",
    accountHolder: process.env.BANK_ACCOUNT_HOLDER ?? "",
  }),
};
