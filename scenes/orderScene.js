const { Scenes, Markup } = require('telegraf');
const Order = require('../models/Order');

const orderScene = new Scenes.WizardScene(
  'order-wizard',

  // 0. Город
  async (ctx) => {
    ctx.wizard.state.data = {};
    await ctx.reply('Выберите город доставки:', Markup.keyboard(['Москва+обл.', 'Санкт-Петербург+обл.']).oneTime().resize());
    return ctx.wizard.next();
  },

  // 1. Тип продукта
  async (ctx) => {
    const city = ctx.message.text;
    if (!['Москва+обл.', 'Санкт-Петербург+обл.'].includes(city)) return ctx.reply('Пожалуйста, выберите город из списка.');
    ctx.wizard.state.data.city = city;
    await ctx.reply('Что требуется?', Markup.keyboard(['Бетон', 'Раствор']).oneTime().resize());
    return ctx.wizard.next();
  },

  // 2. Наполнитель (или переход сразу к марке/объёму)
  async (ctx) => {
    const type = ctx.message.text;
    if (!['Бетон', 'Раствор'].includes(type)) return ctx.reply('Пожалуйста, выберите из вариантов.');
    ctx.wizard.state.data.productType = type;

    if (type === 'Раствор') {
      ctx.wizard.state.data.fillerType = 'Нет';
      await ctx.reply('Введите марку материала (например, М100):');
      return ctx.wizard.selectStep(4);
    }

    const city = ctx.wizard.state.data.city;
    if (city === 'Москва+обл.') {
      await ctx.reply('Выберите тип наполнителя:', Markup.keyboard(['Гранит', 'Гравий']).oneTime().resize());
      return ctx.wizard.next();
    } else {
      ctx.wizard.state.data.fillerType = 'Гранит';
      await ctx.reply('Введите марку материала (например, М300):');
      return ctx.wizard.selectStep(4);
    }
  },

  // 3. Филлер (только для Москва+обл.)
  async (ctx) => {
    if (!ctx.wizard.state.data.fillerType) {
      const filler = ctx.message.text;
      if (!['Гранит', 'Гравий'].includes(filler)) return ctx.reply('Пожалуйста, выберите тип наполнителя.');
      ctx.wizard.state.data.fillerType = filler;
    }
    await ctx.reply('Введите марку материала (например, М300):');
    return ctx.wizard.next();
  },

  // 4. Марка материала
  async (ctx) => {
    ctx.wizard.state.data.materialGrade = ctx.message.text;
    await ctx.reply('Укажите объём в м³:', Markup.keyboard([['Помощь в расчёте']]).oneTime().resize());
    return ctx.wizard.next();
  },

  // 5. Объём или расчёт
  async (ctx) => {
    const text = ctx.message.text;
    if (text === 'Помощь в расчёте') {
      ctx.wizard.state.volumeCalc = {};
      await ctx.reply('Введите длину в метрах:');
      return ctx.wizard.selectStep(16);
    }
    const volume = parseFloat(text.replace(',', '.'));
    if (isNaN(volume)) return ctx.reply('Введите корректное число.');
    ctx.wizard.state.data.volume = volume;
    await ctx.reply('Как хотите указать адрес?', Markup.keyboard([['Ввести вручную', 'Отправить геолокацию']]).oneTime().resize());
    return ctx.wizard.next();
  },

  // 6. Способ указания адреса
  async (ctx) => {
    const choice = ctx.message.text;
    if (choice === 'Ввести вручную') {
      await ctx.reply('Введите адрес доставки:');
      return ctx.wizard.selectStep(8);
    }
    if (choice === 'Отправить геолокацию') {
      await ctx.reply('Отправьте геопозицию через кнопку 📎.');
      return ctx.wizard.selectStep(7);
    }
    return ctx.reply('Выберите из вариантов.');
  },

  // 7. Получение геолокации
  async (ctx) => {
    if (!ctx.message.location) return ctx.reply('Пожалуйста, отправьте геопозицию.');
    const { latitude, longitude } = ctx.message.location;
    ctx.wizard.state.data.deliveryAddress = `Геолокация: https://maps.google.com/?q=${latitude},${longitude}`;
    await ctx.reply('Укажите дату и время доставки:');
    return ctx.wizard.selectStep(9);
  },

  // 8. Адрес вручную
  async (ctx) => {
    ctx.wizard.state.data.deliveryAddress = ctx.message.text;
    await ctx.reply('Укажите дату и время доставки:');
    return ctx.wizard.next();
  },

  // 9. Дата и время
  async (ctx) => {
    ctx.wizard.state.data.deliveryDateTime = ctx.message.text;
    await ctx.reply('Способ подачи:', Markup.keyboard(['Самослив', 'Автобетононасос']).oneTime().resize());
    return ctx.wizard.next();
  },

  // 10. Подача и насос
  async (ctx) => {
    const method = ctx.message.text;
    if (!['Самослив', 'Автобетононасос'].includes(method)) return ctx.reply('Выберите способ подачи.');
    ctx.wizard.state.data.deliveryMethod = method;
    if (method === 'Автобетононасос') {
      await ctx.reply('Укажите длину стрелы:', Markup.keyboard(['22м', '24м', '28м', '32м', '36м', '40м', '52м']).oneTime().resize());
      return ctx.wizard.next();
    }
    ctx.wizard.state.data.pumpLength = 'Не требуется';
    await ctx.reply('Вы физлицо или юрлицо?', Markup.keyboard(['Физлицо', 'Юрлицо']).oneTime().resize());
    return ctx.wizard.selectStep(12);
  },

  // 11. Длина стрелы
  async (ctx) => {
    ctx.wizard.state.data.pumpLength = ctx.message.text;
    await ctx.reply('Вы физлицо или юрлицо?', Markup.keyboard(['Физлицо', 'Юрлицо']).oneTime().resize());
    return ctx.wizard.next();
  },

  // 12. Тип клиента
  async (ctx) => {
    ctx.wizard.state.data.customerType = ctx.message.text;
    await ctx.reply('Способ оплаты:', Markup.keyboard(['Наличный расчёт', 'Безналичный расчёт']).oneTime().resize());
    return ctx.wizard.next();
  },

  // 13. Способ оплаты
  async (ctx) => {
    const payment = ctx.message.text;
    if (!['Наличный расчёт', 'Безналичный расчёт'].includes(payment)) {
      return ctx.reply('Пожалуйста, выберите способ оплаты из списка.');
    }
    ctx.wizard.state.data.paymentMethod = payment;
    await ctx.reply('Введите номер телефона (например, +7 999 123-45-67):');
    return ctx.wizard.next();
  },

  // 14. Телефон
  async (ctx) => {
    const phone = ctx.message.text.trim();
    const phoneRegex = /^((\+7|8)[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/;
    if (!phoneRegex.test(phone)) {
      await ctx.reply('❗ Введите корректный номер. Пример: +7 999 123-45-67');
      return;
    }
    ctx.wizard.state.data.phoneNumber = phone;
    await ctx.reply('Добавьте комментарий или напишите "нет":');
    return ctx.wizard.next();
  },

  // 15. Сохранение заявки (после комментария)
  async (ctx) => {
    ctx.wizard.state.data.comment = ctx.message.text;
    ctx.wizard.state.data.telegramId = ctx.from.id;
    await Order.create(ctx.wizard.state.data);

    try {
      await ctx.telegram.sendMessage(ctx.from.id, '✅ Ваша заявка принята и передана в работу!');
    } catch (err) {
      console.error('❗ Ошибка при отправке клиенту:', err);
    }

    // Отправка админу (проверь adminId)
    const adminId = 7811172186;
    const data = ctx.wizard.state.data;
    await ctx.telegram.sendMessage(adminId,
      `📬 *Новая заявка:*\n🏙 *Город:* ${data.city}\n🧱 *Тип:* ${data.productType} (${data.fillerType})\n🏷 *Марка:* ${data.materialGrade}\n📦 *Объём:* ${data.volume} м³\n📍 *Адрес:* ${data.deliveryAddress}\n🕒 *Дата/время:* ${data.deliveryDateTime}\n🚚 *Подача:* ${data.deliveryMethod} (${data.pumpLength})\n👤 *Клиент:* ${data.customerType}, ${data.phoneNumber}\n🧾 *Оплата:* ${data.paymentMethod}\n💬 *Комментарий:* ${data.comment || '—'}`,
      { parse_mode: 'Markdown' }
    );

    return ctx.scene.leave();
  },

  // 16. Длина (расчёт)
  async (ctx) => {
    const length = parseFloat(ctx.message.text.replace(',', '.'));
    if (isNaN(length)) return ctx.reply('Введите длину в метрах.');
    ctx.wizard.state.volumeCalc.length = length;
    await ctx.reply('Теперь введите ширину:');
    return ctx.wizard.next();
  },

  // 17. Ширина (расчёт)
  async (ctx) => {
    const width = parseFloat(ctx.message.text.replace(',', '.'));
    if (isNaN(width)) return ctx.reply('Введите ширину в метрах.');
    ctx.wizard.state.volumeCalc.width = width;
    await ctx.reply('Теперь введите высоту:');
    return ctx.wizard.next();
  },

  // 18. Высота (расчёт)
  async (ctx) => {
    const height = parseFloat(ctx.message.text.replace(',', '.'));
    if (isNaN(height)) return ctx.reply('Введите высоту в метрах.');
    const { length, width } = ctx.wizard.state.volumeCalc;
    const volume = +(length * width * height).toFixed(2);
    ctx.wizard.state.data.volume = volume;
    await ctx.reply(`📐 Расчётный объём: *${volume} м³*`, { parse_mode: 'Markdown' });
    await ctx.reply('Использовать этот объём?', Markup.keyboard([['✅ Да', '❌ Нет, ввести вручную']]).oneTime().resize());
    return ctx.wizard.next();
  },

  // 19. Подтверждение расчёта или ручной ввод
  async (ctx) => {
    const answer = ctx.message.text;
    if (answer === '✅ Да') {
      await ctx.reply('📍 Как хотите указать адрес?', Markup.keyboard([['Ввести вручную', 'Отправить геолокацию']]).oneTime().resize());
      return ctx.wizard.selectStep(6);
    }
    if (answer === '❌ Нет, ввести вручную') {
      await ctx.reply('Введите объём в м³:');
      return ctx.wizard.selectStep(5);
    }
    return ctx.reply('Выберите "✅ Да" или "❌ Нет, ввести вручную".');
  }
);

module.exports = orderScene;


