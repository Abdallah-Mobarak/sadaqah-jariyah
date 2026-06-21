// Load environment variables from .env if present (no external library)
try { process.loadEnvFile('.env'); } catch (e) { /* file missing — that's fine */ }

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const { securityHeaders, rateLimit } = require('./middleware');
const store = require('./db/store');
const adhkar = require('./data/adhkar.json');

const app = express();

// Behind a proxy (nginx/host) — so req.ip and secure cookies work correctly
if (config.isProd) app.set('trust proxy', 1);

// ===== Core setup =====
app.set('view engine', 'ejs');
app.set('views', config.paths.views);
app.use(securityHeaders);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(config.paths.public));

if (!fs.existsSync(config.paths.uploads)) fs.mkdirSync(config.paths.uploads, { recursive: true });

app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8,
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies, // HTTPS only — toggled via SECURE_COOKIES=true
  },
}));

// Image uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, config.paths.uploads),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
      cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
    },
  }),
  limits: { fileSize: config.upload.maxSize },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

// Variables available to all templates
app.use((req, res, next) => {
  res.locals.isAdmin = !!(req.session && req.session.admin);
  res.locals.path = req.path;
  res.locals.DEEDS = config.deeds;
  next();
});

// Rate limiters to prevent flooding
const duaLimiter = rateLimit({ windowMs: 60 * 1000, max: 8, message: 'أرسلت أدعية كثيرة، انتظر دقيقة.' });
const likeLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

// Health check (useful for hosting platforms)
app.get('/healthz', (req, res) => res.json({ ok: true }));

// ===== Public pages =====
app.get('/', (req, res) => {
  // Default order: most read/remembered/prayed-for first
  const list = store.listDeceased('approved')
    .slice()
    .sort((a, b) => ((b.readCount + b.prayCount) - (a.readCount + a.prayCount)));
  res.render('index', { title: 'صدقة جارية', list });
});

app.get('/add', (req, res) => {
  res.render('add', { title: 'إضافة متوفّى', error: null, sent: false });
});

app.post('/add',
  rateLimit({ windowMs: 60 * 1000, max: 5, onLimit: (req, res) =>
    res.status(429).render('add', { title: 'إضافة متوفّى', error: 'محاولات كثيرة، انتظر دقيقة ثم حاول.', sent: false }) }),
  upload.single('photo'),
  (req, res) => {
    const { name, bio } = req.body;
    let deeds = req.body.deeds || [];
    if (!Array.isArray(deeds)) deeds = [deeds];
    if (!name || !name.trim()) {
      return res.status(400).render('add', { title: 'إضافة متوفّى', error: 'من فضلك اكتب اسم المتوفّى.', sent: false });
    }
    const photo = req.file ? '/uploads/' + req.file.filename : null;
    store.addDeceased({ name, bio, photo, deeds });
    res.render('add', { title: 'تم الإرسال', error: null, sent: true });
  });

// Deceased page
app.get('/m/:id', (req, res) => {
  const d = store.getDeceased(req.params.id);
  if (!d || (d.status !== 'approved' && !res.locals.isAdmin)) {
    return res.status(404).render('404', { title: 'غير موجود' });
  }
  const duas = store.listDuas(d.id);
  res.render('deceased', { title: d.name, d, duas, adhkar });
});

// Add a dua
app.post('/m/:id/dua', duaLimiter, (req, res) => {
  const d = store.getDeceased(req.params.id);
  if (!d || d.status !== 'approved') return res.status(404).json({ ok: false });
  const dua = store.addDua({ deceasedId: d.id, name: req.body.name, text: req.body.text });
  if (!dua) return res.status(400).json({ ok: false, error: 'الدعاء فارغ' });
  store.incr(d.id, 'prayCount');
  if (req.headers['x-requested-with'] === 'fetch') {
    return res.json({ ok: true, dua, prayCount: store.getDeceased(d.id).prayCount });
  }
  res.redirect('/m/' + d.id + '#duas');
});

// Like / unlike a dua
app.post('/dua/:id/like', likeLimiter, (req, res) => {
  const likes = store.likeDua(req.params.id);
  if (likes === null) return res.status(404).json({ ok: false });
  res.json({ ok: true, likes });
});

app.post('/dua/:id/unlike', likeLimiter, (req, res) => {
  const likes = store.unlikeDua(req.params.id);
  if (likes === null) return res.status(404).json({ ok: false });
  res.json({ ok: true, likes });
});

// Record participation (reading / dhikr)
app.post('/m/:id/participate', likeLimiter, (req, res) => {
  const d = store.getDeceased(req.params.id);
  if (!d || d.status !== 'approved') return res.status(404).json({ ok: false });
  const count = store.incr(d.id, 'readCount');
  res.json({ ok: true, readCount: count });
});

// ===== Standalone tools =====
app.get('/quran', (req, res) => res.render('tools/quran-page', { title: 'المصحف', forId: null }));
app.get('/adhkar', (req, res) => res.render('tools/adhkar-page', { title: 'أذكار الصباح والمساء', forId: null, adhkar }));
app.get('/tasbeeh', (req, res) => res.render('tools/tasbeeh-page', { title: 'السبحة الإلكترونية', forId: null }));
app.get('/prayer-times', (req, res) => res.render('tools/prayer-page', { title: 'مواقيت الصلاة', forId: null }));

// ===== Admin dashboard =====
app.get('/admin/login', (req, res) => {
  if (res.locals.isAdmin) return res.redirect('/admin');
  res.render('admin/login', { title: 'دخول المشرف', error: null });
});

const loginLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 10, onLimit: (req, res) =>
  res.status(429).render('admin/login', { title: 'دخول المشرف', error: 'محاولات كثيرة، انتظر قليلًا.' }) });

app.post('/admin/login', loginLimiter, (req, res) => {
  if (req.body.password === config.adminPassword) {
    req.session.admin = true;
    return res.redirect('/admin');
  }
  res.status(401).render('admin/login', { title: 'دخول المشرف', error: 'كلمة المرور غير صحيحة' });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/admin/login');
}

function deletePhotoFile(photo) {
  if (!photo) return;
  const p = path.join(config.paths.public, photo);
  try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { /* ignore */ }
}

app.get('/admin', requireAdmin, (req, res) => {
  res.render('admin/dashboard', {
    title: 'لوحة التحكم',
    pending: store.listDeceased('pending'),
    approved: store.listDeceased('approved'),
    hidden: store.listDeceased('rejected'),
  });
});

// Edit a deceased (full admin access)
app.get('/admin/edit/:id', requireAdmin, (req, res) => {
  const d = store.getDeceased(req.params.id);
  if (!d) return res.status(404).render('404', { title: 'غير موجود' });
  res.render('admin/edit', { title: 'تعديل: ' + d.name, d, duas: store.listDuas(d.id) });
});

app.post('/admin/edit/:id', requireAdmin, upload.single('photo'), (req, res) => {
  const d = store.getDeceased(req.params.id);
  if (!d) return res.status(404).render('404', { title: 'غير موجود' });
  let deeds = req.body.deeds || [];
  if (!Array.isArray(deeds)) deeds = [deeds];
  const fields = { name: req.body.name, bio: req.body.bio, deeds, status: req.body.status };
  if (req.file) {
    deletePhotoFile(d.photo); // replace the old photo
    fields.photo = '/uploads/' + req.file.filename;
  } else if (req.body.removePhoto === '1') {
    deletePhotoFile(d.photo);
    fields.photo = null;
  }
  store.updateDeceased(req.params.id, fields);
  res.redirect('/admin/edit/' + req.params.id);
});

app.post('/admin/approve/:id', requireAdmin, (req, res) => {
  store.setStatus(req.params.id, 'approved');
  res.redirect('/admin');
});

app.post('/admin/reject/:id', requireAdmin, (req, res) => {
  store.setStatus(req.params.id, 'rejected');
  res.redirect('/admin');
});

app.post('/admin/delete/:id', requireAdmin, (req, res) => {
  const d = store.getDeceased(req.params.id);
  if (d) deletePhotoFile(d.photo);
  store.removeDeceased(req.params.id);
  res.redirect('/admin');
});

app.post('/admin/dua/delete/:id', requireAdmin, (req, res) => {
  store.removeDua(req.params.id);
  res.redirect(req.get('referer') || '/admin');
});

// ===== 404 and error handler =====
app.use((req, res) => res.status(404).render('404', { title: 'غير موجود' }));

app.use((err, req, res, next) => {
  console.error('Unexpected error:', err.message);
  if (res.headersSent) return next(err);
  // Image upload errors (too large / unsupported type)
  const msg = err.code === 'LIMIT_FILE_SIZE' ? 'حجم الصورة كبير (الحد 4 ميجابايت).' : null;
  res.status(500).render('500', { title: 'خطأ', message: msg });
});

// ===== Start =====
app.listen(config.port, () => {
  console.log(`Sadaqah Jariyah running at: http://localhost:${config.port}`);
  if (!config.isProd) {
    console.log(`Admin dashboard: http://localhost:${config.port}/admin  (password: ${config.adminPassword})`);
  }
  if (config.isProd) {
    if (config.adminPassword === 'admin1234') console.warn('WARNING: default admin password in use — change ADMIN_PASSWORD now.');
    if (config.sessionSecret.includes('change-me')) console.warn('WARNING: default SESSION_SECRET in use — change it.');
    if (!config.secureCookies) console.warn('INFO: SECURE_COOKIES is off — enable it (=true) if your site uses HTTPS.');
  }
});
