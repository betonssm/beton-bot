const { Scenes, Markup } = require('telegraf');
const Order = require('../models/Order');

const orderScene = new Scenes.WizardScene(
  'order-wizard',

  // 1. Город
  async (ctx) => {
    ctx.wizard.state.data = {};
    await ctx.reply('Выберите город доставки:', Markup.keyboard(['Москва', 'Санкт-Петербург']).oneTime().resize());
    return ctx.wizard.next();
  },

  // 2. Тип продукта
  async (ctx) => {
    const city = ctx.message.text;
    if (!['Москва', 'Санкт-Петербург'].includes(city)) return ctx.reply('Пожалуйста, выберите город из списка.');
    ctx.wizard.state.data.city = city;

    await ctx.reply('Что требуется?', Markup.keyboard(['Бетон', 'Раствор']).oneTime().resize());
    return ctx.wizard.next();
  },

  // 3. Тип наполнителя
  async (ctx) => {
    const type = ctx.message.text;
    if (!['Бетон', 'Раствор'].includes(type)) return ctx.reply('Пожалуйста, выберите из вариантов.');

    ctx.wizard.state.data.productType = type;

    if (type === 'Раствор') {
      ctx.wizard.state.data.fillerType = 'Нет';
      return ctx.wizard.selectStep(4); // Пропускаем выбор щебня
    }

    const city = ctx.wizard.state.data.city;
    if (city === 'Москва') {
      await ctx.reply('Выберите тип наполнителя:', Markup.keyboard(['Гранит', 'Гравий']).oneTime().resize());
    } else {
      ctx.wizard.state.data.fillerType = 'Гранит';
      return ctx.wizard.selectStep(4); // Пропускаем выбор, т.к. только гранит
    }

    return ctx.wizard.next();
  },

  // 4. Сохраняем наполнитель (только для Москвы)
  async (ctx) => {
    if (!ctx.wizard.state.data.fillerType) {
      const filler = ctx.message.text;
      if (!['Гранит', 'Гравий'].includes(filler)) return ctx.reply('Пожалуйста, выберите тип наполнителя.');
      ctx.wizard.state.data.fillerType = filler;
    }

    await ctx.reply('Введите марку материала (например, М300):');
    return ctx.wizard.next();
  },

  // 5. Марка
  async (ctx) => {
    ctx.wizard.state.data.materialGrade = ctx.message.text;
    await ctx.reply('Укажите объём в м³:', Markup.keyboard([
      ['Помощь в расчёте']
    ]).oneTime().resize());
    return ctx.wizard.next();
  },

 // 6. Объём
async (ctx) => {
  const text = ctx.message.text;

  if (text === 'Помощь в расчёте') {
    await ctx.reply('✏️ Введите длину опалубки в метрах:');
    ctx.wizard.state.volumeCalc = {};
    return ctx.wizard.selectStep(60); // Переход в кастомную подсцену
  }

  const volume = parseFloat(text.replace(',', '.'));
  if (isNaN(volume)) {
    return ctx.reply('❗ Введите числовое значение объёма или нажмите "Помощь в расчёте".');
  }

  ctx.wizard.state.data.volume = volume;
  await ctx.reply('Укажите адрес доставки:');
  return ctx.wizard.next();
},
// 6.1 — Способ ввода адреса
async (ctx) => {
  await ctx.reply('📍 Как хотите указать адрес?', Markup.keyboard([
    ['Ввести вручную', 'Отправить геолокацию']
  ]).oneTime().resize());

  return ctx.wizard.next();
},
// 6.2 — Обработка выбора способа
async (ctx) => {
  const choice = ctx.message.text;

  if (choice === 'Ввести вручную') {
    await ctx.reply('✏️ Укажите адрес доставки:');
    return ctx.wizard.selectStep(7); // как раньше
  }

  if (choice === 'Отправить геолокацию') {
    await ctx.reply('📍 Пожалуйста, отправьте геопозицию через кнопку 📎 (прикрепить).');
    return ctx.wizard.selectStep(6.3);
  }

  return ctx.reply('Пожалуйста, выберите один из вариантов.');
},
// 6.3 — Получение геолокации
async (ctx) => {
  if (!ctx.message.location) {
    return ctx.reply('❗ Пожалуйста, отправьте именно геопозицию с помощью кнопки 📎.');
  }

  const { latitude, longitude } = ctx.message.location;

  ctx.wizard.state.data.deliveryAddress = `Геолокация: https://maps.google.com/?q=${latitude},${longitude}`;

  await ctx.reply('🗓 Укажите дату и время доставки (например, 12 мая 10:00):');
  return ctx.wizard.selectStep(8); // пропускаем ручной ввод адреса
},

  // 7. Адрес
  async (ctx) => {
    ctx.wizard.state.data.deliveryAddress = ctx.message.text;
    await ctx.reply('Укажите дату и время доставки (например, 12 мая 10:00):');
    return ctx.wizard.next();
  },

  // 8. Дата и время
  async (ctx) => {
    ctx.wizard.state.data.deliveryDateTime = ctx.message.text;
    await ctx.reply('Способ подачи:', Markup.keyboard(['Самослив', 'Автобетононасос']).oneTime().resize());
    return ctx.wizard.next();
  },

  // 9. Способ подачи и насос (если выбран)
  async (ctx) => {
    const method = ctx.message.text;
    if (!['Самослив', 'Автобетононасос'].includes(method)) return ctx.reply('Выберите способ подачи.');

    ctx.wizard.state.data.deliveryMethod = method;

    if (method === 'Автобетононасос') {
      await ctx.reply('Укажите длину стрелы:', Markup.keyboard(['22м', '24м', '28м', '32м', '36м', '40м', '52м']).oneTime().resize());
      return ctx.wizard.next();
    }

    ctx.wizard.state.data.pumpLength = 'Не требуется';
    return ctx.wizard.selectStep(10);
  },

  // 10. Длина стрелы насоса
  async (ctx) => {
    ctx.wizard.state.data.pumpLength = ctx.message.text;
    await ctx.reply('Вы физлицо или юрлицо?', Markup.keyboard(['Физлицо', 'Юрлицо']).oneTime().resize());
    return ctx.wizard.next();
  },

  // 11. Тип клиента
  async (ctx) => {
    ctx.wizard.state.data.customerType = ctx.message.text;
    await ctx.reply('Способ оплаты:', Markup.keyboard(['Наличный расчёт', 'Безналичный расчёт']).oneTime().resize());
    return ctx.wizard.next();
  },

  // 12. Оплата
  async (ctx) => {
    ctx.wizard.state.data.paymentMethod = ctx.message.text;
    await ctx.reply('Введите контактный телефон:');
    return ctx.wizard.next();
  },

  // 13. Телефон
async (ctx) => {
  const phone = ctx.message.text.trim();

  // Простой шаблон для проверки российских номеров
  const phoneRegex = /^(\+7|8)?[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/;

  if (!phoneRegex.test(phone)) {
    await ctx.reply('❗ Пожалуйста, введите корректный номер телефона. Пример: +7 999 123-45-67');
    return;
  }

  ctx.wizard.state.data.phoneNumber = phone;
  await ctx.reply('Добавьте комментарий (если есть) или напишите "нет":');
  return ctx.wizard.next();
},
// 60. Ввод длины
async (ctx) => {
  const length = parseFloat(ctx.message.text.replace(',', '.'));
  if (isNaN(length)) return ctx.reply('❗ Введите число (длину в метрах)');
  ctx.wizard.state.volumeCalc.length = length;
  await ctx.reply('Теперь введите ширину опалубки в метрах:');
  return ctx.wizard.selectStep(61);
},

// 61. Ввод ширины
async (ctx) => {
  const width = parseFloat(ctx.message.text.replace(',', '.'));
  if (isNaN(width)) return ctx.reply('❗ Введите число (ширину в метрах)');
  ctx.wizard.state.volumeCalc.width = width;
  await ctx.reply('Теперь введите высоту (или глубину) опалубки в метрах:');
  return ctx.wizard.selectStep(62);
},

// 62. Ввод высоты и расчёт
async (ctx) => {
  const height = parseFloat(ctx.message.text.replace(',', '.'));
  if (isNaN(height)) return ctx.reply('❗ Введите число (высоту в метрах)');

  const { length, width } = ctx.wizard.state.volumeCalc;
  const volume = +(length * width * height).toFixed(2);
  ctx.wizard.state.data.volume = volume;

  await ctx.reply(`📐 Расчётный объём: *${volume} м³*`, {
    parse_mode: 'Markdown'
  });

  await ctx.reply('Использовать этот объём?', Markup.keyboard([
    ['✅ Да', '❌ Нет, ввести вручную']
  ]).oneTime().resize());

  return ctx.wizard.selectStep(63);
},
// 63. Подтверждение объёма
async (ctx) => {
  const answer = ctx.message.text;

  if (answer === '✅ Да') {
    await ctx.reply('Укажите адрес доставки:');
    return ctx.wizard.selectStep(7); // Переход к следующему шагу
  }

  if (answer === '❌ Нет, ввести вручную') {
    await ctx.reply('Хорошо, введите объём в м³:', Markup.removeKeyboard());
    return ctx.wizard.selectStep(6); // Возврат к ручному вводу
  }

  return ctx.reply('Пожалуйста, выберите "✅ Да" или "❌ Нет, ввести вручную".');
},
  // 14. Комментарий и сохранение
async (ctx) => {
  ctx.wizard.state.data.comment = ctx.message.text;
  ctx.wizard.state.data.telegramId = ctx.from.id;

  // Сохраняем заявку в MongoDB
  await Order.create(ctx.wizard.state.data);

  // Подтверждение клиенту
  try {
    await ctx.telegram.sendMessage(
      ctx.from.id,
      '✅ Ваша заявка принята и передана в работу! Спасибо, что обратились к нам.'
    );
  } catch (err) {
    console.error('❗ Не удалось отправить сообщение клиенту:', err);
  }

  // Уведомление тебе (или менеджеру)
  const adminId = 7811172186;
  const data = ctx.wizard.state.data;

  await ctx.telegram.sendMessage(adminId, 
    `📬 *Новая заявка:*\n\n` +
    `🏙 *Город:* ${data.city}\n` +
    `🧱 *Тип:* ${data.productType} (${data.fillerType})\n` +
    `🏷 *Марка:* ${data.materialGrade}\n` +
    `📦 *Объём:* ${data.volume} м³\n` +
    `📍 *Адрес:* ${data.deliveryAddress}\n` +
    `🕒 *Дата/время:* ${data.deliveryDateTime}\n` +
    `🚚 *Подача:* ${data.deliveryMethod} (${data.pumpLength})\n` +
    `👤 *Клиент:* ${data.customerType}, ${data.phoneNumber}\n` +
    `🧾 *Оплата:* ${data.paymentMethod}\n` +
    `💬 *Комментарий:* ${data.comment || '—'}`,
    { parse_mode: 'Markdown' }
  );

  return ctx.scene.leave();
},
)
module.exports = orderScene;