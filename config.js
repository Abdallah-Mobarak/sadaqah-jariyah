// App configuration — all settings in one place
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  isProd,
  port: parseInt(process.env.PORT, 10) || 3000,

  // Change these before deploying to the internet (via .env)
  adminPassword: process.env.ADMIN_PASSWORD || 'admin1234',
  sessionSecret: process.env.SESSION_SECRET || 'sadaqah-jariyah-secret-change-me',

  // Enable (=true) only when served over HTTPS, otherwise login won't work
  secureCookies: process.env.SECURE_COOKIES === 'true',

  paths: {
    public: path.join(__dirname, 'public'),
    views: path.join(__dirname, 'views'),
    uploads: path.join(__dirname, 'public', 'uploads'),
  },

  upload: { maxSize: 4 * 1024 * 1024 }, // 4 MB

  // Deeds the submitter can choose when adding a deceased (labels shown to users, in Arabic)
  deeds: [
    { key: 'quran', label: 'قراءة القرآن' },
    { key: 'adhkar', label: 'أذكار الصباح والمساء' },
    { key: 'tasbeeh', label: 'تسبيح' },
    { key: 'salah', label: 'الصلاة على النبي ﷺ' },
    { key: 'dua', label: 'الدعاء له' },
  ],
};
