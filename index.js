const express = require('express');
const { Telegraf, Scenes, session } = require('telegraf');
const mongoose = require('mongoose');
require('dotenv').config();
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// Подключение к MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ Подключено к MongoDB!');
}).catch((err) => {
  console.error('❌ Ошибка подключения к MongoDB:', err);
});

const bot = new Telegraf(process.env.BOT_TOKEN);

// 👉 Подключаем сцену
const orderScene = require('./scenes/orderScene');
const stage = new Scenes.Stage([orderScene]);
bot.use(session());
bot.use(stage.middleware());

// Команды
// Кнопки "Оставить заявку" и "Получить консультацию ИИ"
bot.start((ctx) =>
  ctx.reply(
    '👋 Добро пожаловать! Выберите действие:',
    {
      reply_markup: {
        keyboard: [
          ['📝 Оставить заявку'],
          ['🤖 Получить консультацию ИИ']
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
      }
    }
  )
);

// Обработка кнопок
bot.hears('📝 Оставить заявку', (ctx) => ctx.scene.enter('order-wizard'));


bot.hears('🤖 Получить консультацию ИИ', (ctx) => {
  ctx.session.waitingAiQuestion = true;
  ctx.reply('💬 Напишите ваш вопрос по бетону или строительству:');
});

// Далее ловим следующее сообщение пользователя:
bot.on('text', async (ctx, next) => {
  if (ctx.session.waitingAiQuestion) {
    ctx.session.waitingAiQuestion = false;
    const userQuestion = ctx.message.text;
    await ctx.reply('⏳ Запрос отправлен ИИ, ждите ответ...');

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo", // или "gpt-4", если есть доступ
        messages: [
          { role: "system", content: "Ты — профессиональный строительный консультант по товарному бетону, помогаешь выбрать марку и ответить на вопросы клиента." },
          { role: "user", content: userQuestion }
        ],
        max_tokens: 700,
        temperature: 0.5,
      });
      const answer = completion.choices[0]?.message?.content || "Извините, не удалось получить ответ от ИИ.";
      await ctx.reply('🤖 Ответ ИИ:\n' + answer);
    } catch (e) {
      console.error(e);
      await ctx.reply('❗ Ошибка обращения к ИИ, попробуйте позже.');
    }
  } else {
    // Другие текстовые сообщения
    return next();
  }
});
bot.hears('🤖 Получить консультацию ИИ', (ctx) => {
  ctx.session.waitingAiQuestion = true;
  ctx.reply(
    '💬 Напишите ваш вопрос по бетону или строительству:',
    {
      reply_markup: {
        keyboard: [['⬅️ Назад']],
        resize_keyboard: true,
        one_time_keyboard: false,
      }
    }
  );
});
bot.hears('⬅️ Назад', (ctx) => {
  ctx.session.waitingAiQuestion = false;
  ctx.reply(
    '👋 Выберите действие:',
    {
      reply_markup: {
        keyboard: [
          ['📝 Оставить заявку'],
          ['🤖 Получить консультацию ИИ']
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
      }
    }
  );
});
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