require('dotenv').config(); // local: .env file project ke root folder mein
const express = require('express'), mongoose = require('mongoose'), cors = require('cors'), jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs');
const { User, Campus, Student, Voucher, Expense, Teacher, Salary } = require('./models');
const app = express(); app.use(cors()); app.use(express.json());

// ---- Campuses (pehle se bane hue) ----
const CAMPUSES = ['7C Campus', 'Karachi Cambridge School 4/B', 'SAJ Nighat Mannan Campus 7/D', 'Campus 5-B/3', 'Campus 7/A'];
const seed = async () => {
  for (let i = 0; i < CAMPUSES.length; i++) await Campus.updateOne({ name: CAMPUSES[i] }, { $setOnInsert: { order: i } }, { upsert: true });
  const c7 = await Campus.findOne({ name: CAMPUSES[0] });
  // purana data (jab sirf 7C tha) 7C Campus ke naam kar do
  for (const M of [Student, Voucher, Expense, Teacher, Salary]) await M.updateMany({ campus: null }, { $set: { campus: c7._id } });
  await User.updateMany({ role: { $exists: false } }, { $set: { role: 'director' } });
};

// Health check (UptimeRobot ping ke liye, DB ke bagair)
app.get('/api/health', (q, r) => r.json({ ok: true }));

// DB connection cache: Vercel serverless me har request par naya connection na bane
let conn = null;
const connectDB = () => conn || (conn = mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 }).then(seed).catch(e => { conn = null; throw e; }));
app.use('/api', async (q, r, n) => { try { await connectDB(); n(); } catch (e) { r.status(500).json({ error: 'Database connection failed. Check MONGO_URI and Atlas Network Access (0.0.0.0/0). ' + e.message }); } });
const w = f => (q, r, n) => f(q, r, n).catch(e => r.status(400).json({ error: e.code === 11000 ? 'Already exists (this email may be in use)' : e.message }));
const crypto = require('crypto'), path = require('path'), fs = require('fs');
if (!process.env.JWT_SECRET) { console.error('JWT_SECRET missing in .env'); process.exit(1); }

// Har login par naya sessionId banta hai -> purane devices ka token automatically invalid ho jata hai
// Director: ek hi device. Campus accounts: kitne bhi devices (sessionId sirf password badalne par badalta hai)
const newSession = async u => { if (u.role !== 'campus' || !u.sessionId) { u.sessionId = crypto.randomBytes(16).toString('hex'); await u.save(); } return jwt.sign({ id: u._id, sid: u.sessionId }, process.env.JWT_SECRET, { expiresIn: '30d' }); };
const isId = v => mongoose.Types.ObjectId.isValid(v);
const auth = async (q, r, n) => {
  try {
    const t = jwt.verify((q.headers.authorization || '').slice(7), process.env.JWT_SECRET);
    const u = await User.findById(t.id);
    if (!u || !t.sid || u.sessionId !== t.sid) return r.status(401).json({ error: 'You were logged out because this account was opened on another device.', loggedOut: true });
    q.user = u;
    // Campus wale user sirf apna campus dekh sakte hain; director header se campus chunta hai
    if (u.role === 'campus') q.campusId = u.campus;
    else { const h = q.headers['x-campus']; if (h && isId(h) && (await Campus.exists({ _id: h }))) q.campusId = h; }
    n();
  } catch { r.status(401).json({ error: 'Please login first' }); }
};
const director = (q, r, n) => (q.user.role === 'director' ? n() : r.status(403).json({ error: 'Only the director can do this' }));
const inCampus = (q, r, n) => (q.campusId ? n() : r.status(400).json({ error: 'Please select a campus first' }));
const data = [auth, inCampus]; // saare campus-data routes
const clean = b => { const { campus, _id, createdAt, updatedAt, __v, ...rest } = b || {}; return rest; };
const mine = q => ({ campus: q.campusId });
const sum = a => a.reduce((s, x) => s + (x.amount || 0), 0);
const me = async u => ({ role: u.role, name: u.name, email: u.email, campus: u.role === 'campus' ? await Campus.findById(u.campus) : null });

// ---- Auth: pehla form sirf ek dafa (director setup), uske baad sirf login ----
app.get('/api/auth/me', auth, w(async (q, r) => r.json(await me(q.user))));
app.get('/api/auth/status', w(async (q, r) => r.json({ setupNeeded: (await User.countDocuments()) === 0 })));
app.post('/api/auth/setup', w(async (q, r) => {
  if (await User.countDocuments()) throw new Error('Account already created');
  const { name, email, phone, password } = q.body;
  if (!email || !phone || !password || password.length < 6) throw new Error('Email, phone and a password of at least 6 characters are required');
  const u = await User.create({ role: 'director', name, email, phone, password: await bcrypt.hash(password, 10) });
  r.json({ token: await newSession(u), ...(await me(u)) });
}));
app.post('/api/auth/login', w(async (q, r) => {
  const u = await User.findOne({ email: (q.body.email || '').toLowerCase().trim() });
  if (!u || !(await bcrypt.compare(q.body.password || '', u.password))) throw new Error('Incorrect email or password');
  r.json({ token: await newSession(u), ...(await me(u)) });
}));
// Apna password badalna (director aur campus dono). Badalte hi baaqi sab devices logout ho jate hain, aur is device ko naya token milta hai.
app.put('/api/auth/password', auth, w(async (q, r) => {
  const { current, password } = q.body;
  if (!(await bcrypt.compare(current || '', q.user.password))) throw new Error('Current password is incorrect');
  if (!password || password.length < 6) throw new Error('New password must be at least 6 characters');
  q.user.password = await bcrypt.hash(password, 10); q.user.sessionId = null; await q.user.save();
  r.json({ token: await newSession(q.user) });
}));
// Account: email aur/ya password badalna (director aur campus dono). Password badalne par baaqi devices logout ho jate hain.
app.put('/api/auth/account', auth, w(async (q, r) => {
  const { current, email, password } = q.body, u = q.user;
  if (!(await bcrypt.compare(current || '', u.password))) throw new Error('Current password is incorrect');
  const e = (email || '').toLowerCase().trim();
  if (e && e !== u.email) {
    if (await User.findOne({ email: e, _id: { $ne: u._id } })) throw new Error('This email is already used by another account');
    u.email = e;
  }
  if (password) {
    if (password.length < 6) throw new Error('New password must be at least 6 characters');
    u.password = await bcrypt.hash(password, 10); u.sessionId = null;
  }
  await u.save();
  r.json({ token: await newSession(u), email: u.email });
}));
app.post('/api/auth/logout', auth, w(async (q, r) => { if (q.user.role === 'director') await User.findByIdAndUpdate(q.user._id, { sessionId: null }); r.json({ ok: true }); })); // campus logout sirf us device ka

// ---- Campuses & logins ----
app.get('/api/campuses', auth, w(async (q, r) => {
  if (q.user.role === 'campus') return r.json(await Campus.find({ _id: q.user.campus }));
  const list = await Campus.find().sort({ order: 1, name: 1 }).lean(), users = await User.find({ role: 'campus' });
  r.json(list.map(c => ({ ...c, login: users.find(u => String(u.campus) === String(c._id))?.email || '' })));
}));
// Director har campus ka email/password banata ya badalta hai
app.put('/api/campuses/:id/account', auth, director, w(async (q, r) => {
  const c = await Campus.findById(q.params.id); if (!c) throw new Error('Campus not found');
  const email = (q.body.email || '').toLowerCase().trim(), password = q.body.password || '';
  if (!email) throw new Error('Email is required');
  let u = await User.findOne({ role: 'campus', campus: c._id });
  if (!u && password.length < 6) throw new Error('Password must be at least 6 characters');
  if (password && password.length < 6) throw new Error('Password must be at least 6 characters');
  const other = await User.findOne({ email, ...(u && { _id: { $ne: u._id } }) });
  if (other) throw new Error('This email is already used by another account');
  if (!u) u = new User({ role: 'campus', campus: c._id, name: c.name });
  u.email = email; if (password) { u.password = await bcrypt.hash(password, 10); u.sessionId = null; } // password badla to purana login khatam
  await u.save(); r.json({ ok: true });
}));

// ---- Students / Admission ----
const net = s => Math.max(0, (+s.monthlyFee || 0) - (+s.discount || 0)); // discount ke baad fee
app.get('/api/students', data, w(async (q, r) => {
  const f = { ...mine(q), active: true }; if (q.query.class) f.class = q.query.class; if (q.query.section) f.section = q.query.section;
  r.json(await Student.find(f).sort({ class: 1, section: 1, name: 1 }));
}));
app.post('/api/students', data, w(async (q, r) => {
  const last = await Student.findOne(mine(q)).sort({ admissionNo: -1 });
  const s = await Student.create({ ...clean(q.body), ...mine(q), admissionDate: q.body.admissionDate || new Date().toISOString().slice(0, 10), admissionNo: (last?.admissionNo || 0) + 1 });
  const month = s.admissionDate.slice(0, 7);
  await Voucher.create({ ...mine(q), student: s._id, month, type: 'admission', amount: (+s.admissionFee || 0) + net(s) }); // admission + pehle mahine ki fee
  r.json(s);
}));
app.put('/api/students/:id', data, w(async (q, r) => r.json(await Student.findOneAndUpdate({ _id: q.params.id, ...mine(q) }, clean(q.body), { new: true }))));
app.delete('/api/students/:id', data, w(async (q, r) => {
  const s = await Student.findOne({ _id: q.params.id, ...mine(q) }); if (!s) throw new Error('Student not found');
  await Voucher.deleteMany({ student: s._id, ...mine(q) }); r.json(await Student.findByIdAndDelete(s._id));
}));

// ---- Fee Vouchers ----
app.post('/api/vouchers/generate', data, w(async (q, r) => {
  const { month, class: c } = q.body; const f = { ...mine(q), active: true }; if (c) f.class = c;
  let made = 0;
  for (const s of await Student.find(f)) {
    if (s.admissionDate && s.admissionDate.slice(0, 7) > month) continue; // admission se pehle ke mahine skip
    if (await Voucher.exists({ student: s._id, month })) continue; // is mahine ka voucher pehle se hai
    await Voucher.create({ ...mine(q), student: s._id, month, amount: net(s) }); made++;
  }
  r.json({ made });
}));
app.get('/api/vouchers', data, w(async (q, r) => {
  const f = { ...mine(q) }; if (q.query.month) f.month = q.query.month; if (q.query.status) f.status = q.query.status;
  let list = await Voucher.find(f).populate('student').sort({ createdAt: 1 });
  list = list.filter(v => v.student && (!q.query.class || v.student.class === q.query.class));
  r.json(list);
}));
app.put('/api/vouchers/:id', data, w(async (q, r) => r.json(await Voucher.findOneAndUpdate({ _id: q.params.id, ...mine(q) }, clean(q.body), { new: true }))));
app.delete('/api/vouchers/:id', data, w(async (q, r) => r.json(await Voucher.findOneAndDelete({ _id: q.params.id, ...mine(q) }))));
app.put('/api/vouchers/:id/pay', data, w(async (q, r) =>
  r.json(await Voucher.findOneAndUpdate({ _id: q.params.id, ...mine(q) }, { status: 'paid', paidDate: q.body.date || new Date().toISOString().slice(0, 10) }, { new: true }))));

// ---- Expenses ----
app.get('/api/expenses', data, w(async (q, r) => r.json(await Expense.find({ ...mine(q), ...(q.query.date && { date: q.query.date }) }).sort({ date: -1 }).limit(300))));
app.post('/api/expenses', data, w(async (q, r) => r.json(await Expense.create({ ...clean(q.body), ...mine(q) }))));
app.put('/api/expenses/:id', data, w(async (q, r) => r.json(await Expense.findOneAndUpdate({ _id: q.params.id, ...mine(q) }, clean(q.body), { new: true }))));
app.delete('/api/expenses/:id', data, w(async (q, r) => r.json(await Expense.findOneAndDelete({ _id: q.params.id, ...mine(q) }))));
app.get('/api/expenses/history', data, w(async (q, r) => {
  const f = { ...mine(q) }; if (q.query.month) f.date = new RegExp('^' + q.query.month);
  r.json(await Expense.find(f).sort({ date: -1, createdAt: -1 }));
}));

// ---- Teachers / Salary ----
app.get('/api/teachers', data, w(async (q, r) => r.json(await Teacher.find(mine(q)).sort({ name: 1 }))));
app.post('/api/teachers', data, w(async (q, r) => r.json(await Teacher.create({ ...clean(q.body), ...mine(q) }))));
app.put('/api/teachers/:id', data, w(async (q, r) => r.json(await Teacher.findOneAndUpdate({ _id: q.params.id, ...mine(q) }, clean(q.body), { new: true }))));
app.delete('/api/salaries/:id', data, w(async (q, r) => r.json(await Salary.findOneAndDelete({ _id: q.params.id, ...mine(q) }))));
app.delete('/api/teachers/:id', data, w(async (q, r) => r.json(await Teacher.findOneAndDelete({ _id: q.params.id, ...mine(q) }))));
app.get('/api/salaries', data, w(async (q, r) => r.json(await Salary.find({ ...mine(q), month: q.query.month }))));
app.post('/api/teachers/:id/pay', data, w(async (q, r) => {
  const t = await Teacher.findOne({ _id: q.params.id, ...mine(q) }), b = q.body; if (!t) throw new Error('Teacher not found');
  if (await Salary.exists({ teacher: t._id, month: b.month })) throw new Error('Salary for this month is already paid');
  const base = +t.salary || 0, deduction = Math.max(0, +b.deduction || 0);
  r.json(await Salary.create({ ...mine(q), teacher: t._id, month: b.month, baseSalary: base, lateDays: +b.lateDays || 0, offDays: +b.offDays || 0,
    deduction, amount: Math.max(0, base - deduction), paidDate: b.date }));
}));

// ---- Daily statement / Dashboard (ek campus) ----
app.get('/api/report', data, w(async (q, r) => {
  const d = q.query.date, c = mine(q);
  const fees = await Voucher.find({ ...c, paidDate: d }).populate('student', 'name class section');
  const exp = await Expense.find({ ...c, date: d });
  const sal = await Salary.find({ ...c, paidDate: d }).populate('teacher', 'name');
  const unpaid = await Voucher.find({ ...c, status: 'unpaid' });
  r.json({ date: d, fees, exp, sal, totalIn: sum(fees), totalOut: sum(exp) + sum(sal),
    students: await Student.countDocuments({ ...c, active: true }), pending: sum(unpaid), pendingCount: unpaid.length });
}));
const monthStats = async (c, m) => {
  const re = new RegExp('^' + m);
  const fees = await Voucher.find({ ...c, paidDate: re }), exp = await Expense.find({ ...c, date: re }), sal = await Salary.find({ ...c, month: m });
  const due = await Voucher.find({ ...c, month: m, status: 'unpaid' });
  const teachers = await Teacher.find(c); const paidIds = sal.map(x => String(x.teacher));
  const pendingSal = teachers.filter(t => !paidIds.includes(String(t._id)));
  return { month: m, income: sum(fees), expenses: sum(exp), salaries: sum(sal), net: sum(fees) - sum(exp) - sum(sal),
    feesDue: sum(due), feesDueCount: due.length, salaryPending: pendingSal.reduce((s, t) => s + (t.salary || 0), 0), salaryPendingCount: pendingSal.length };
};
app.get('/api/report/month', data, w(async (q, r) => r.json(await monthStats(mine(q), q.query.month))));

// ---- Director: saare campuses ka ek saath statement ----
app.get('/api/overview', auth, director, w(async (q, r) => {
  const d = q.query.date, m = d.slice(0, 7), re = new RegExp('^' + m);
  const list = await Campus.find().sort({ order: 1, name: 1 }).lean();
  const rows = await Promise.all(list.map(async c => {
    const k = { campus: c._id };
    const fees = await Voucher.find({ ...k, paidDate: d }), exp = await Expense.find({ ...k, date: d }), sal = await Salary.find({ ...k, paidDate: d });
    const unpaid = await Voucher.find({ ...k, status: 'unpaid' });
    const mo = await monthStats(k, m);
    return { _id: c._id, name: c.name, students: await Student.countDocuments({ ...k, active: true }),
      income: sum(fees), expenses: sum(exp), salaries: sum(sal), left: sum(fees) - sum(exp) - sum(sal),
      pending: sum(unpaid), pendingCount: unpaid.length, month: mo };
  }));
  const T = f => rows.reduce((s, x) => s + f(x), 0);
  r.json({ date: d, rows, totals: { students: T(x => x.students), income: T(x => x.income), expenses: T(x => x.expenses), salaries: T(x => x.salaries),
    left: T(x => x.left), pending: T(x => x.pending), pendingCount: T(x => x.pendingCount),
    month: { income: T(x => x.month.income), expenses: T(x => x.month.expenses), salaries: T(x => x.month.salaries), net: T(x => x.month.net), salaryPending: T(x => x.month.salaryPending) } } });
}));

// ---- Production: frontend build isi server se serve hota hai (ek hi deploy) ----
const dist = path.join(__dirname, '..', '..', 'dist');
if (fs.existsSync(dist)) { app.use(express.static(dist)); app.get(/^\/(?!api).*/, (q, r) => r.sendFile(path.join(dist, 'index.html'))); }

module.exports = app;
if (require.main === module) connectDB().then(() => app.listen(process.env.PORT || 5000, () => console.log('Server running'))).catch(e => console.error('MongoDB connection failed. Check MONGO_URI in .env: ' + e.message));
