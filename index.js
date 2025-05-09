const express = require('express');
const { Telegraf, Scenes, session } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// 👉 Подключаем сцену
const orderScene = require('./scenes/orderScene');
const stage = new Scenes.Stage([orderScene]);
bot.use(session());
bot.use(stage.middleware());

// Команды
bot.start((ctx) => ctx.reply('👋 Добро пожаловать! Чтобы оставить заявку на бетон, напишите /zayavka'));
bot.command('zayavka', (ctx) => ctx.scene.enter('order-wizard'));

// 💡 Express-сервер
const app = express();
app.use(express.json());
app.use(bot.webhookCallback('/webhook'));

// 🚀 Установка Webhook
(async () => {
  const url = process.env.WEBHOOK_URL; // Пример: https://beton-bot.onrender.com
  await bot.telegram.setWebhook(`${url}/webhook`);
  console.log('✅ Webhook установлен:', `${url}/webhook`);
})();

// 🌐 Старт Express-сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер слушает порт ${PORT}`);
});