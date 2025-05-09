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
    await ctx.reply('Укажите объём в м³:');
    return ctx.wizard.next();
  },

  // 6. Объём
  async (ctx) => {
    const volume = parseFloat(ctx.message.text.replace(',', '.'));
    if (isNaN(volume)) return ctx.reply('Введите числовое значение объёма.');
    ctx.wizard.state.data.volume = volume;

    await ctx.reply('Укажите адрес доставки:');
    return ctx.wizard.next();
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
    ctx.wizard.state.data.phoneNumber = ctx.message.text;
    await ctx.reply('Добавьте комментарий (если есть) или напишите "нет":');
    return ctx.wizard.next();
  },

  // 14. Комментарий и сохранение
  async (ctx) => {
    ctx.wizard.state.data.comment = ctx.message.text;

    // Сохраняем заявку в MongoDB
    await Order.create(ctx.wizard.state.data);

    await ctx.reply('✅ Спасибо! Ваша заявка принята. Мы свяжемся с вами в ближайшее время.');

    return ctx.scene.leave();
  }
);

module.exports = orderScene;