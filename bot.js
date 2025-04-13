require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const nodemailer = require('nodemailer');
const axios = require('axios');
const fs = require('fs');

const bot = new Telegraf(process.env.BOT_TOKEN);

const cardNames = JSON.parse(fs.readFileSync('./cards.json', 'utf8'));
const userSelections = {}; // { userId: 'Карта 1' }

// Формируем главное меню из данных
const mainMenu = Markup.inlineKeyboard(
  Object.entries(cardNames).map(([key, name]) => [Markup.button.callback(name, key)])
);

// Форма заявки
const contactForm = Markup.inlineKeyboard([
  [Markup.button.callback('Оставить заявку менеджеру', 'send_request')],
  [Markup.button.callback('⬅️ Назад', 'back_to_main')],
]);

// Старт
bot.start((ctx) => {
  ctx.reply('Выберите нужную карту 👇', mainMenu);
});

// Выбор карты
bot.action(/^buy_card_\d+$/, (ctx) => {
  const userId = ctx.from.id;
  const choiceKey = ctx.callbackQuery.data; // ← это надёжнее, чем match
  const cardName = cardNames[choiceKey] || 'Неизвестно';

  userSelections[userId] = cardName;

  ctx.editMessageText(`Вы выбрали: ${cardName}
Хотите оставить заявку менеджеру?`, contactForm);
});

// Назад
bot.action('back_to_main', (ctx) => {
  ctx.editMessageText('Выберите нужную карту 👇', mainMenu);
});

// Заявка
bot.action('send_request', async (ctx) => {
  const userId = ctx.from.id;
  const card = userSelections[userId] || 'Неизвестно';
  const message = `📩 Заявка от пользователя\n🧾 Карта: ${card}\n🆔 Telegram ID: ${userId}`;

  await ctx.editMessageText('Наш менеджер свяжется с вами в ближайшее время 😊');

  // Отправка на почту
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Telegram Бот" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: 'Заявка от Telegram-бота',
      text: message,
    });
    console.log('Заявка отправлена на почту');
  } catch (error) {
    console.error('Ошибка при отправке email:', error);
  }

  // Отправка в другие боты
  await sendToOtherBots(message);
});

// Отправка сообщений в другие боты
async function sendToOtherBots(text) {
  const bots = [
    { token: process.env.BOT_TOKEN_2, chatId: process.env.CHAT_ID_2 },
    { token: process.env.BOT_TOKEN_3, chatId: process.env.CHAT_ID_3 },
  ];

  for (const { token, chatId } of bots) {
    try {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text,
      });
    } catch (err) {
      console.error(`Ошибка при отправке в бот с токеном ${token}:`, err.message);
    }
  }
}

// Запуск
bot.launch();
console.log('Бот запущен!');