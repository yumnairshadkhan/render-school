const m = require('mongoose'), S = m.Schema;
// sessionId: sirf ek device ka login valid rehta hai (naya login purane ko logout kar deta hai)
exports.Campus = m.model('Campus', new S({ name: { type: String, unique: true }, order: Number }));
exports.User = m.model('User', new S({ role: { type: String, enum: ['director', 'campus'], default: 'director' }, campus: { type: S.Types.ObjectId, ref: 'Campus' }, name: String, email: { type: String, unique: true, lowercase: true }, phone: String, password: String, sessionId: String }));
exports.Student = m.model('Student', new S({
  campus: { type: S.Types.ObjectId, ref: 'Campus', index: true },
  admissionNo: Number, admissionDate: String, name: String, gender: { type: String, enum: ['Male', 'Female'], default: 'Male' },
  fatherName: String, phone: String, address: String, dob: String,
  class: String, section: { type: String, default: 'A' },
  monthlyFee: Number,            // asli (standard) fee
  discount: { type: Number, default: 0 }, // mahana discount (Rs)
  discountNote: String,
  admissionFee: { type: Number, default: 0 },
  active: { type: Boolean, default: true } }, { timestamps: true }));
const V = new S({ campus: { type: S.Types.ObjectId, ref: 'Campus', index: true }, student: { type: S.Types.ObjectId, ref: 'Student' }, month: String, amount: Number,
  type: { type: String, default: 'monthly' }, status: { type: String, default: 'unpaid' }, paidDate: String }, { timestamps: true });
V.index({ student: 1, month: 1, type: 1 }, { unique: true });
exports.Voucher = m.model('Voucher', V);
exports.Expense = m.model('Expense', new S({ campus: { type: S.Types.ObjectId, ref: 'Campus', index: true }, date: String, title: String, amount: Number, note: String }));
exports.Teacher = m.model('Teacher', new S({ campus: { type: S.Types.ObjectId, ref: 'Campus', index: true }, name: String, phone: String, subject: String, salary: Number }));
exports.Salary = m.model('Salary', new S({ campus: { type: S.Types.ObjectId, ref: 'Campus', index: true }, teacher: { type: S.Types.ObjectId, ref: 'Teacher' }, month: String,
  baseSalary: Number, lateDays: { type: Number, default: 0 }, offDays: { type: Number, default: 0 }, deduction: { type: Number, default: 0 },
  amount: Number, // net jo diya gaya
  paidDate: String }));
