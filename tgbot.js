const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const moment = require('moment');
const sqlite3 = require('sqlite3');
const token = envTG_Bot_Token;
const bot = new TelegramBot(token, { polling: true });

const db = new sqlite3.Database('users.db');

db.run(`CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY,
  chat_id INTEGER,
  botcoin INTEGER,
  last_claim DATETIME,
  referral_code INTEGER,
  referred_by INTEGER
)`, (err) => {
    if (err) {
        return console.error('Tablo oluşturulurken hata oluştu:', err);
    }

    db.all('SELECT * FROM users', (err, rows) => {
        if (err) {
            console.error('Veritabanından veri okunamadı:', err);
        } else {
            rows.forEach(row => {
                users[row.user_id] = {
                    chatId: row.chat_id,
                    botcoin: row.botcoin,
                    last_claim: row.last_claim ? new Date(row.last_claim) : null,
                    referral_code: row.referral_code,
                    referredBy: row.referred_by
                };
            });
        }
    });
});

let users = {};

bot.onText(/\/start$/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!users[userId]) {
        users[userId] = {
            chatId,
            botcoin: 100,
            last_claim: null,
            referral_code: null,
            referredBy: null
        };

        const replyOptions = {
            reply_markup: JSON.stringify({
                keyboard: [
                    ['/cuzdan'],
                    ['/referans'],
                    ['/claim'],
                ],
                resize_keyboard: true,
                one_time_keyboard: true,
            })
        };

        db.run(`INSERT INTO users (user_id, chat_id, botcoin, last_claim, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?)`, [userId, chatId, 100, null, null, null],
            function(err) {
                if (err) {
                    return console.error(err.message);
                }
                bot.sendMessage(chatId, 'Hoş geldin! 100 botcoin hesabınıza eklendi. Kullanabileceğiniz komutlar:', replyOptions);
            }
        );
    } else {
        bot.sendMessage(chatId, 'Zaten kayıtlısınız. Kullanabileceğiniz komutlar: /cuzdan, /referans, /claim');
    }
});

bot.onText(/\/cuzdan/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const replyOptions = {
        reply_markup: JSON.stringify({
            keyboard: [
                ['/cuzdan'],
                ['/referans'],
                ['/claim'],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
        })
    };

    if (!users[userId]) {
        bot.sendMessage(chatId, 'Lütfen önce /start komutunu kullanarak botu başlatın.', replyOptions);
        return;
    }

    const botcoin = users[userId].botcoin;
    bot.sendMessage(chatId, `Cüzdanınızda ${botcoin} botcoin bulunmaktadır.`, replyOptions);
});

bot.onText(/\/referans/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const replyOptions = {
        reply_markup: JSON.stringify({
            keyboard: [
                ['/cuzdan'],
                ['/referans'],
                ['/claim'],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
        })
    };

    if (!users[userId]) {
        bot.sendMessage(chatId, 'Lütfen önce /start komutunu kullanarak botu başlatın.', replyOptions);
        return;
    }

    const referralLink = `https://t.me/ExpTgBot?start=${userId}`;

    users[userId].referral_code = userId;

    db.run(`UPDATE users SET referral_code = ? WHERE user_id = ?`, [userId, userId], function(err) {
        if (err) {
            return console.error(err.message);
        }
        bot.sendMessage(chatId, `Referans linkiniz: ${referralLink}`, replyOptions);
    });
});

bot.onText(/\/start ([0-9]+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const referralCode = match[1];

    const replyOptions = {
        reply_markup: JSON.stringify({
            keyboard: [
                ['/cuzdan'],
                ['/referans'],
                ['/claim'],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
        })
    };

    if (!users[userId]) {
        users[userId] = {
            chatId,
            botcoin: 100,
            last_claim: null,
            referral_code: null,
            referredBy: referralCode
        };

        if (referralCode && users[referralCode]) {
            users[referralCode].botcoin += 10;
            db.run(`UPDATE users SET botcoin = ? WHERE user_id = ?`, [users[referralCode].botcoin, referralCode], function(err) {
                if (err) {
                    return console.error(err.message);
                }
                bot.sendMessage(users[referralCode].chatId, `Tebrikler! Referansınızla bir kullanıcı botu başlattı ve 10 botcoin kazandınız.`, replyOptions);
            });
        }

        db.run(`INSERT INTO users (user_id, chat_id, botcoin, last_claim, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?)`, [userId, chatId, 100, null, null, referralCode],
            function(err) {
                if (err) {
                    return console.error(err.message);
                }
                bot.sendMessage(chatId, 'Hoş geldin! 100 botcoin hesabınıza eklendi. Kullanabileceğiniz komutlar:', replyOptions);
            }
        );
    } else {
        bot.sendMessage(chatId, 'Zaten kayıtlısınız. Kullanabileceğiniz komutlar: /cuzdan, /referans, /claim');
    }
});

bot.onText(/\/claim/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!users[userId]) {
        bot.sendMessage(chatId, 'Lütfen önce /start komutunu kullanarak botu başlatın.');
        return;
    }

    const now = moment();
    const lastClaim = users[userId].last_claim;

    if (lastClaim && moment(lastClaim).add(5, 'minutes').isAfter(now)) {
        bot.sendMessage(chatId, '5 dakikada birden fazla talepte bulunamazsınız. Lütfen tekrar deneyin.', {
            reply_markup: {
                keyboard: [
                    ['/cuzdan'],
                    ['/referans'],
                    ['/claim'],
                ]
            }
        });
        return;
    }

    users[userId].botcoin += 20;
    users[userId].last_claim = now;

    db.run(`UPDATE users SET botcoin = ?, last_claim = ? WHERE user_id = ?`, [users[userId].botcoin, now.toISOString(), userId], function(err) {
        if (err) {
            return console.error(err.message);
        }
        bot.sendMessage(chatId, 'Hesabınıza 20 botcoin eklendi!', {
            reply_markup: {
                keyboard: [
                    ['/cuzdan'],
                    ['/referans'],
                    ['/claim'],
                ]
            }
        });
    });

    const commissionRate = 0.1; // %10 komisyon
    let commissionAmount = 0;

    if (users[userId].referredBy) {
        commissionAmount = Math.floor(20 * commissionRate);
        users[users[userId].referredBy].botcoin += commissionAmount;
        db.run(`UPDATE users SET botcoin = ? WHERE user_id = ?`, [users[users[userId].referredBy].botcoin, users[userId].referredBy], function(err) {
            if (err) {
                return console.error(err.message);
            }
            bot.sendMessage(users[users[userId].referredBy].chatId, `Referansınız ${userId} tarafından ${commissionAmount} botcoin kazandı!`, {
                reply_markup: {
                    keyboard: [
                        ['/cuzdan'],
                        ['/referans'],
                        ['/claim'],
                    ]
                }
            });
        });
    }

    // İkinci seviye komisyon oranını belirleyin
    const secondLevelCommissionRate = 0.015; // %1.5 komisyon

    // İkinci seviye referansı kontrol edin ve komisyon hesaplayın
    if (users[users[userId].referredBy] && users[users[userId].referredBy].referredBy) {
        const secondLevelCommissionAmount = Math.floor(20 * secondLevelCommissionRate);
        users[users[users[userId].referredBy].referredBy].botcoin += secondLevelCommissionAmount;

        db.run(`UPDATE users SET botcoin = ? WHERE user_id = ?`, [users[users[users[userId].referredBy].referredBy].botcoin, users[users[userId].referredBy].referredBy], function(err) {
            if (err) {
                return console.error(err.message);
            }
            bot.sendMessage(users[users[users[userId].referredBy].referredBy].chatId, `Torununuz ${userId} tarafından ${secondLevelCommissionAmount} botcoin kazandı!`, {
                reply_markup: {
                    keyboard: [
                        ['/cuzdan'],
                        ['/referans'],
                        ['/claim'],
                    ]
                }
            });
        });
    }
});

// Her 5 dakikada bir 'claim' komutunu kontrol edin
cron.schedule('*/5 * * * *', () => {
    // Buraya gerekli işlemleri ekleyin
});