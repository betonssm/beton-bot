require('dotenv').config();
const { Telegraf, Scenes, session } = require('telegraf');
const mongoose = require('mongoose');
const orderScene = require('./scenes/orderScene');

// Инициализируем бота
const bot = new Telegraf(process.env.BOT_TOKEN);

// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB подключена'))
  .catch(err => console.error('❌ Ошибка MongoDB:', err));

// Настройка сцен
const stage = new Scenes.Stage([orderScene]);
bot.use(session());
bot.use(stage.middleware());

// Команда /start
bot.start((ctx) => {
  ctx.reply('👋 Добро пожаловать! Чтобы оставить заявку на бетон, напишите /zayavka');
});

// Команда на запуск заявки
bot.command('zayavka', (ctx) => ctx.scene.enter('order-wizard'));

// Запуск бота
bot.launch().then(() => {
  console.log('🤖 Бот запущен');
});

// Для корректного завершения
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));