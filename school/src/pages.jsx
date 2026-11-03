import { useEffect, useState, useCallback } from 'react';
import { api, CLASSES, SECTIONS, clsName, today, thisMonth, dayName } from './api.js';
const Rs = n => 'Rs ' + (n || 0).toLocaleString();
const Cls = s => clsName(s.class) + ' - ' + s.section;
const useLoad = (path, deps = []) => {
  const [d, setD] = useState([]);
  const load = useCallback(() => api(path).then(setD).catch(() => {}), [path]);
  useEffect(() => { load(); }, [load, ...deps]);
  return [d, load];
};
const ClassSelect = ({ value, onChange, all }) => (
  <select value={value} onChange={e => onChange(e.target.value)}>{all && <option value="">All Classes</option>}{CLASSES.map(c => <option key={c} value={c}>{clsName(c)}</option>)}</select>
);
const Empty = ({ t }) => <p className="muted">{t}</p>;

const longDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shiftDay = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); const p = v => String(v).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; };
const Section = ({ icon, title, color, items, total, empty, render }) => (
  <div className={'card dsec ' + color}>
    <div className="dsec-h"><span>{icon} {title}</span><span><span className="badge">{items.length}</span> <b>{Rs(total)}</b></span></div>
    {items.map(render)}{!items.length && <Empty t={empty} />}
  </div>
);

export function Dashboard() {
  const [date, setDate] = useState(today()), [d, setD] = useState(null), [mo, setMo] = useState(null);
  useEffect(() => { api('/report?date=' + date).then(setD).catch(() => {}); api('/report/month?month=' + date.slice(0, 7)).then(setMo).catch(() => {}); }, [date]);
  const left = d ? d.totalIn - d.totalOut : 0, isToday = date === today();
  const spentPct = mo && mo.income > 0 ? Math.min(100, Math.round(((mo.expenses + mo.salaries) / mo.income) * 100)) : 0;
  return (<>
    <div className="dhead">
      <div><h2>{isToday ? "Today's Report" : 'Daily Report'}</h2><p className="muted">{longDate(date)}</p></div>
      <div className="dpick">
        <button className={'btn ghost sm' + (isToday ? ' sel' : '')} onClick={() => setDate(today())}>Today</button>
        <button className={'btn ghost sm' + (date === shiftDay(today(), -1) ? ' sel' : '')} onClick={() => setDate(shiftDay(today(), -1))}>Yesterday</button>
        <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} className="auto" />
      </div>
    </div>
    {!d && <p className="muted">Loading report...</p>}
    {d && <>
      <div className="hero">
        <div className="hbox in"><small>💰 Money In</small><b>{Rs(d.totalIn)}</b><span>Fees received</span></div>
        <div className="hbox out"><small>💸 Money Out</small><b>{Rs(d.totalOut)}</b><span>Expenses + salaries</span></div>
        <div className={'hbox ' + (left < 0 ? 'neg' : 'net')}><small>{left < 0 ? '⚠️ Loss' : '✅ Left'}</small><b>{Rs(Math.abs(left))}</b><span>{left < 0 ? 'Spent more than received' : 'Saved today'}</span></div>
      </div>
      <p className="summary">{isToday ? 'Today' : 'On this day'} the school received <b className="g">{Rs(d.totalIn)}</b> in fees and spent <b className="r">{Rs(d.totalOut)}</b>, so <b>{left < 0 ? 'it is ' + Rs(-left) + ' short.' : Rs(left) + ' is left.'}</b></p>

      <div className="alerts">
        <div className="alert warn"><span>⏳ Fees Not Yet Paid</span><b>{Rs(d.pending)}</b><small>{d.pendingCount} voucher(s) waiting</small></div>
        {mo && <div className="alert warn"><span>👩‍🏫 Salaries Pending ({mo.month})</span><b>{Rs(mo.salaryPending)}</b><small>{mo.salaryPendingCount} teacher(s) not paid yet</small></div>}
        <div className="alert info"><span>🎓 Total Students</span><b>{d.students}</b><small>currently enrolled</small></div>
      </div>

      <Section icon="📥" title="Fees Received" color="gr" items={d.fees} total={d.fees.reduce((x, v) => x + v.amount, 0)} empty="No fees received on this day."
        render={v => <div className="line" key={v._id}><span>{v.student?.name} <small className="muted">({v.student && Cls(v.student)})</small></span><b>{Rs(v.amount)}</b></div>} />
      <Section icon="🧾" title="Expenses" color="rd" items={d.exp} total={d.exp.reduce((x, v) => x + v.amount, 0)} empty="No expenses on this day."
        render={v => <div className="line" key={v._id}><span>{v.title}</span><b>{Rs(v.amount)}</b></div>} />
      <Section icon="👩‍🏫" title="Salaries Paid" color="bl" items={d.sal} total={d.sal.reduce((x, v) => x + v.amount, 0)} empty="No salaries paid on this day."
        render={v => <div className="line" key={v._id}><span>{v.teacher?.name}</span><b>{Rs(v.amount)}</b></div>} />

      {mo && <div className="card mon">
        <h3>📅 This Month ({mo.month})</h3>
        <div className="flow">
          <div><small>Fees received</small><b className="g">{Rs(mo.income)}</b></div><span>−</span>
          <div><small>Expenses</small><b>{Rs(mo.expenses)}</b></div><span>−</span>
          <div><small>Salaries</small><b>{Rs(mo.salaries)}</b></div><span>=</span>
          <div className={'res ' + (mo.net < 0 ? 'neg' : 'net')}><small>{mo.net < 0 ? 'Loss' : 'Left'}</small><b>{Rs(Math.abs(mo.net))}</b></div>
        </div>
        <div className="bar"><i style={{ width: spentPct + '%' }} /></div>
        <p className="muted">{spentPct}% of the fees received this month has been spent.</p>
        <div className="line"><span>Fees still to collect this month ({mo.feesDueCount})</span><b className="r">{Rs(mo.feesDue)}</b></div>
      </div>}
    </>}
  </>);
}

export function Students() {
  const [cls, setCls] = useState(''), [sec, setSec] = useState(''), [open, setOpen] = useState(false), [msg, setMsg] = useState(''), [editId, setEditId] = useState(null);
  const [list, load] = useLoad(`/students?class=${cls}&section=${sec}`);
  const empty = { name: '', gender: 'Male', fatherName: '', phone: '', address: '', dob: '', admissionDate: today(), class: 'Nursery', section: 'A', monthlyFee: '', discount: '', discountNote: '', admissionFee: '' };
  const [f, setF] = useState(empty); const set = k => e => setF({ ...f, [k]: e.target.value });
  const netFee = Math.max(0, (+f.monthlyFee || 0) - (+f.discount || 0));
  const rel = g => (g === 'Female' ? 'D/o' : 'S/o');
  const close = () => { setOpen(false); setEditId(null); setF(empty); };
  const save = async e => {
    e.preventDefault(); const body = Object.fromEntries(Object.keys(empty).map(k => [k, f[k]]));
    try {
      if (editId) { await api('/students/' + editId, { method: 'PUT', body }); setMsg('Student updated. (New fee applies to vouchers generated from now on.)'); }
      else { await api('/students', { method: 'POST', body }); setMsg('Admission completed. Admission voucher created.'); }
      close(); load();
    } catch (x) { setMsg(x.message); }
  };
  const edit = s => { setF({ ...empty, ...s, discount: s.discount || '', discountNote: s.discountNote || '' }); setEditId(s._id); setOpen(true); window.scrollTo(0, 0); };
  return (<>
    <div className="row"><h2>Students</h2><button className="btn" onClick={() => (open ? close() : setOpen(true))}>{open ? 'Close' : '➕ New Admission'}</button></div>
    {msg && <div className="ok">{msg}</div>}
    {open && <form className="card form" onSubmit={save}>
      <h3>{editId ? 'Edit Student' : 'Admission Form'}</h3>
      <div className="row2"><label>Student Name<input required value={f.name} onChange={set('name')} /></label>
        <label>Gender<select value={f.gender} onChange={set('gender')}><option value="Male">Male (Son)</option><option value="Female">Female (Daughter)</option></select></label></div>
      <label>{f.gender === 'Female' ? "Father's Name (D/o)" : "Father's Name (S/o)"}<input required value={f.fatherName} onChange={set('fatherName')} /></label>
      <label>Phone Number<input type="tel" value={f.phone} onChange={set('phone')} /></label>
      <label>Address<input value={f.address} onChange={set('address')} /></label>
      <div className="row2"><label>Date of Birth<input type="date" value={f.dob} onChange={set('dob')} /></label>
        <label>Admission Date<input type="date" value={f.admissionDate} onChange={set('admissionDate')} /></label></div>
      <div className="row2"><label>Class<ClassSelect value={f.class} onChange={v => setF({ ...f, class: v })} /></label>
        <label>Section<select value={f.section} onChange={set('section')}>{SECTIONS.map(s => <option key={s}>{s}</option>)}</select></label></div>
      <div className="row2"><label>Monthly Fee<input type="number" min="0" required value={f.monthlyFee} onChange={set('monthlyFee')} /></label>
        <label>Discount (Rs / month)<input type="number" min="0" value={f.discount} onChange={set('discount')} /></label>
        <label>Admission Fee<input type="number" min="0" value={f.admissionFee} onChange={set('admissionFee')} /></label></div>
      <label>Discount reason (optional)<input value={f.discountNote} onChange={set('discountNote')} placeholder="e.g. sibling, orphan, staff child" /></label>
      <div className="line total"><b>Fee payable every month</b><b className="g">{Rs(netFee)}</b></div>
      <button className="btn">{editId ? 'Save Changes' : 'Save Admission'}</button>
    </form>}
    <div className="row2"><ClassSelect all value={cls} onChange={setCls} />
      <select value={sec} onChange={e => setSec(e.target.value)}><option value="">All Sections</option>{SECTIONS.map(s => <option key={s}>{s}</option>)}</select></div>
    <p className="muted">Total students: {list.length}</p>
    <div className="grid">{list.map(s => <div className="card" key={s._id}>
      <div className="line"><b>{s.name}</b><span className="tag">{Cls(s)}</span></div>
      <div className="muted">{rel(s.gender)} {s.fatherName} · {s.phone}</div><div className="muted">Admission # {s.admissionNo} · {s.admissionDate}</div>
      <div className="line"><span>Monthly fee</span><span>{s.discount > 0 && <small className="muted"><s>{Rs(s.monthlyFee)}</s> − {Rs(s.discount)} = </small>}<b>{Rs(Math.max(0, (s.monthlyFee || 0) - (s.discount || 0)))}</b></span></div>
      {s.discountNote && <div className="muted">Discount: {s.discountNote}</div>}
      <div className="acts"><button className="btn sm" onClick={() => edit(s)}>Edit</button>
        <button className="btn ghost sm" onClick={async () => { if (confirm('Delete this student permanently? All their vouchers will also be deleted.')) { await api('/students/' + s._id, { method: 'DELETE' }); load(); } }}>Delete</button></div>
    </div>)}</div>
    {!list.length && <Empty t="No students found" />}
  </>);
}

export function Vouchers() {
  const [month, setMonth] = useState(thisMonth()), [cls, setCls] = useState(''), [status, setStatus] = useState(''), [msg, setMsg] = useState('');
  const [list, load] = useLoad(`/vouchers?month=${month}&class=${cls}&status=${status}`);
  const gen = async () => { if (!month) return setMsg('Select a month first'); const d = await api('/vouchers/generate', { method: 'POST', body: { month, class: cls } }); setMsg(d.made + ' new vouchers generated'); load(); };
  const put = async (v, body) => { await api('/vouchers/' + v._id, { method: 'PUT', body }); load(); };
  const pay = v => { const d = prompt('Payment date (YYYY-MM-DD)', today()); if (d) put(v, { status: 'paid', paidDate: d }); };
  const edit = v => { const a = prompt('New amount', v.amount); if (a !== null && a !== '') put(v, { amount: +a }); };
  const del = async v => { if (confirm('Delete this voucher?')) { await api('/vouchers/' + v._id, { method: 'DELETE' }); load(); } };
  return (<>
    <h2 className="noprint">Fee Vouchers</h2>
    <div className="row2 noprint"><input type="month" value={month} onChange={e => setMonth(e.target.value)} /><ClassSelect all value={cls} onChange={setCls} />
      <select value={status} onChange={e => setStatus(e.target.value)}><option value="">All</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option></select></div>
    <p className="muted noprint">Pick any month of any year. Clear the month field to see all months.</p>
    <div className="row noprint"><button className="btn" onClick={gen}>Generate Vouchers for Selected Month</button><button className="btn ghost" onClick={() => window.print()}>🖨️ Print</button></div>
    {msg && <div className="ok noprint">{msg}</div>}
    <div className="grid">{list.map(v => <div className="card voucher" key={v._id}>
      <div className="vhead">Sir Adam Jee Schooling System<br /><small>{localStorage.getItem('campusName') || ''} · Fee Voucher</small></div>
      <div className="line"><span>Student</span><b>{v.student.name}</b></div><div className="line"><span>Father</span><span>{v.student.fatherName}</span></div>
      <div className="line"><span>Class</span><span>{Cls(v.student)}</span></div><div className="line"><span>Month</span><span>{v.month} {v.type === 'admission' && '(Admission)'}</span></div>
      {/* Voucher par poori fee dikhti hai, discount nahi. Discount sirf Students page par nazar aata hai. Dashboard mein asal wasool shuda (discount ke baad) amount hi gina jata hai. */}
      <div className="line"><span>Amount</span><b>{Rs(v.amount + (+v.student.discount || 0))}</b></div>
      <div className="line"><span>Status</span><b className={v.status === 'paid' ? 'g' : 'r'}>{v.status === 'paid' ? 'PAID ' + v.paidDate : 'UNPAID'}</b></div>
      <div className="acts noprint">{v.status === 'unpaid' ? <button className="btn sm" onClick={() => pay(v)}>Mark Paid</button> : <button className="btn ghost sm" onClick={() => put(v, { status: 'unpaid', paidDate: null })}>Undo Paid</button>}
        <button className="btn ghost sm" onClick={() => edit(v)}>Edit Amount</button><button className="btn ghost sm" onClick={() => del(v)}>Delete</button></div>
    </div>)}</div>
    {!list.length && <Empty t="No vouchers found. Generate vouchers first." />}
  </>);
}

export function Expenses() {
  const [date, setDate] = useState(today()), [month, setMonth] = useState(thisMonth()), [f, setF] = useState({ title: '', amount: '' });
  const [list, load] = useLoad('/expenses/history?month=' + month, [month]);
  const add = async e => { e.preventDefault(); await api('/expenses', { method: 'POST', body: { ...f, date } }); setF({ title: '', amount: '' }); load(); };
  const edit = async x => { const title = prompt('Expense', x.title); if (title === null) return; const a = prompt('Amount', x.amount); if (a === null || a === '') return; await api('/expenses/' + x._id, { method: 'PUT', body: { title, amount: +a } }); load(); };
  const days = [...new Set(list.map(x => x.date))].sort().reverse();
  return (<>
    <div className="row"><h2>Daily Expenses</h2><input type="month" value={month} onChange={e => setMonth(e.target.value)} className="auto" /></div>
    <form className="card cmp" onSubmit={add}>
      <label>Expense<input required placeholder="e.g. Electricity bill" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></label>
      <label>Rs<input type="number" min="0" required value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></label>
      <label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <button className="btn">➕ Add</button>
    </form>
    <div className="card">
      {days.map(d => { const items = list.filter(x => x.date === d); return <div key={d}>
        <div className="dayhead"><span>{dayName(d)} · {d}</span><span>{Rs(items.reduce((s, x) => s + x.amount, 0))}</span></div>
        {items.map(x => <div className="line" key={x._id}><span>{x.title}</span>
          <span><b>{Rs(x.amount)}</b> <button className="x" title="Edit" onClick={() => edit(x)}>✎</button><button className="x" title="Delete" onClick={async () => { if (confirm('Delete this expense?')) { await api('/expenses/' + x._id, { method: 'DELETE' }); load(); } }}>×</button></span></div>)}
      </div>; })}
      {!list.length && <Empty t="No expenses in this month" />}
      <div className="line total"><b>Month Total</b><b>{Rs(list.reduce((s, x) => s + x.amount, 0))}</b></div></div>
  </>);
}

export function Teachers() {
  const [month, setMonth] = useState(thisMonth()), empty = { name: '', phone: '', subject: '', salary: '' }, [f, setF] = useState(empty), [editId, setEditId] = useState(null), [showForm, setShowForm] = useState(false);
  const [list, load] = useLoad('/teachers'); const [paid, loadPaid] = useLoad('/salaries?month=' + month, [month]);
  const [payFor, setPayFor] = useState(null), [p, setP] = useState({ lateDays: '', offDays: '', deduction: '', date: today() });
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const save = async e => { e.preventDefault(); const body = { name: f.name, phone: f.phone, subject: f.subject, salary: f.salary };
    await api(editId ? '/teachers/' + editId : '/teachers', { method: editId ? 'PUT' : 'POST', body }); setF(empty); setEditId(null); setShowForm(false); load(); };
  const rec = id => paid.find(x => x.teacher === id);
  const perDay = t => Math.round((t.salary || 0) / 30);
  // auto deduction: har off = 1 din ki salary, har 3 late = 1 din ki salary (Cut amount neeche edit ho sakta hai)
  const lateDaysCut = late => Math.floor((+late || 0) / 3);
  const auto = (t, late, off) => ((+off || 0) + lateDaysCut(late)) * perDay(t);
  const setPay = (t, k, v) => { const n = { ...p, [k]: v }; if (k !== 'deduction' && k !== 'date') n.deduction = auto(t, n.lateDays, n.offDays) || ''; setP(n); };
  const openPay = t => { setPayFor(t._id); setP({ lateDays: '', offDays: '', deduction: '', date: today() }); };
  const doPay = async t => { try { await api(`/teachers/${t._id}/pay`, { method: 'POST', body: { month, ...p } }); setPayFor(null); loadPaid(); } catch (x) { alert(x.message); } };
  const paidTotal = paid.reduce((s, x) => s + x.amount, 0), pending = list.filter(t => !rec(t._id));
  return (<>
    <div className="row"><h2>Teachers & Salary</h2><input type="month" value={month} onChange={e => setMonth(e.target.value)} className="auto" /></div>
    <div className="grid stats">
      <div className="card stat b1"><span>Paid ({paid.length})</span><b>{Rs(paidTotal)}</b></div>
      <div className="card stat b2"><span>Pending ({pending.length})</span><b className="r">{Rs(pending.reduce((s, t) => s + (t.salary || 0), 0))}</b></div>
    </div>
    <div className="card">
      {list.map(t => { const r = rec(t._id); return <div key={t._id}>
        <div className="sal">
          <span><b>{t.name}</b><br /><small className="muted">{t.subject}</small></span>
          <span>{Rs(t.salary)}</span>
          <span>{r ? <><span className="chip p">PAID {Rs(r.amount)}</span>{r.deduction > 0 && <small className="muted"><br />late {r.lateDays}, off {r.offDays}, cut {Rs(r.deduction)}</small>}<br /><small className="muted">{r.paidDate}</small></> : <span className="chip u">PENDING</span>}</span>
          <span className="acts">{r ? <button className="btn ghost sm" onClick={async () => { if (confirm('Undo this payment?')) { await api('/salaries/' + r._id, { method: 'DELETE' }); loadPaid(); } }}>Undo</button>
            : <button className="btn sm" onClick={() => openPay(t)}>Pay</button>}
            <button className="btn ghost sm" onClick={() => { setF({ name: t.name, phone: t.phone || '', subject: t.subject || '', salary: t.salary }); setEditId(t._id); setShowForm(true); window.scrollTo(0, 0); }}>Edit</button>
            <button className="x" title="Delete" onClick={async () => { if (confirm('Delete this teacher?')) { await api('/teachers/' + t._id, { method: 'DELETE' }); load(); } }}>×</button></span>
        </div>
        {payFor === t._id && !r && <div className="mini sm2" style={{ padding: '6px 0 10px' }}>
          <label>Late (3 = 1 day)<input type="number" min="0" value={p.lateDays} onChange={e => setPay(t, 'lateDays', e.target.value)} /></label>
          <label>Off<input type="number" min="0" value={p.offDays} onChange={e => setPay(t, 'offDays', e.target.value)} /></label>
          <label>Cut (Rs)<input type="number" min="0" value={p.deduction} onChange={e => setPay(t, 'deduction', e.target.value)} /></label>
          <label>Date<input type="date" style={{ width: 140 }} value={p.date} onChange={e => setPay(t, 'date', e.target.value)} /></label>
          <b>Pay: {Rs(Math.max(0, (t.salary || 0) - (+p.deduction || 0)))}</b>
          <button className="btn sm" onClick={() => doPay(t)}>Confirm</button><button className="btn ghost sm" onClick={() => setPayFor(null)}>Cancel</button>
        </div>}
      </div>; })}
      {!list.length && <Empty t="No teachers added yet" />}
    </div>
    <div className="row"><button className="btn ghost" onClick={() => { setShowForm(!showForm); setEditId(null); setF(empty); }}>{showForm ? 'Close' : '➕ Add Teacher'}</button></div>
    {showForm && <form className="card cmp" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }} onSubmit={save}>
      <label>Name<input required value={f.name} onChange={set('name')} /></label>
      <label>Phone<input value={f.phone} onChange={set('phone')} /></label>
      <label>Subject<input value={f.subject} onChange={set('subject')} /></label>
      <label>Monthly Salary<input type="number" min="0" required value={f.salary} onChange={set('salary')} /></label>
      <button className="btn">{editId ? 'Save' : 'Add'}</button></form>}
    <p className="muted">Cut auto-calculation: 1 day salary = salary ÷ 30. Each Off day = 1 day cut. Every 3 Late = 1 day cut. You can change the Cut amount before confirming.</p>
  </>);
}

// ================= Director: saare campuses =================
export function Overview({ onOpen }) {
  const [date, setDate] = useState(today()), [d, setD] = useState(null), [err, setErr] = useState('');
  useEffect(() => { setErr(''); api('/overview?date=' + date).then(setD).catch(e => setErr(e.message)); }, [date]);
  const isToday = date === today(), T = d?.totals;
  return (<>
    <div className="dhead">
      <div><h2>All Campuses</h2><p className="muted">{longDate(date)}</p></div>
      <div className="dpick">
        <button className={'btn ghost sm' + (isToday ? ' sel' : '')} onClick={() => setDate(today())}>Today</button>
        <button className={'btn ghost sm' + (date === shiftDay(today(), -1) ? ' sel' : '')} onClick={() => setDate(shiftDay(today(), -1))}>Yesterday</button>
        <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} className="auto" />
      </div>
    </div>
    {err && <div className="err">{err}</div>}
    {!d && !err && <p className="muted">Loading report...</p>}
    {d && <>
      <div className="hero">
        <div className="hbox in"><small>💰 Money In (all campuses)</small><b>{Rs(T.income)}</b><span>Fees received</span></div>
        <div className="hbox out"><small>💸 Money Out (all campuses)</small><b>{Rs(T.expenses + T.salaries)}</b><span>Expenses + salaries</span></div>
        <div className={'hbox ' + (T.left < 0 ? 'neg' : 'net')}><small>{T.left < 0 ? '⚠️ Loss' : '✅ Left'}</small><b>{Rs(Math.abs(T.left))}</b><span>{T.students} students in total</span></div>
      </div>
      <div className="alerts">
        <div className="alert warn"><span>⏳ Fees Not Yet Paid (all)</span><b>{Rs(T.pending)}</b><small>{T.pendingCount} voucher(s) waiting</small></div>
        <div className="alert warn"><span>👩‍🏫 Salaries Pending (this month)</span><b>{Rs(T.month.salaryPending)}</b><small>all campuses</small></div>
        <div className="alert info"><span>📅 This Month Left</span><b className={T.month.net < 0 ? 'r' : 'g'}>{Rs(T.month.net)}</b><small>fees − expenses − salaries</small></div>
      </div>
      <h3 style={{ marginTop: 14 }}>Campus-wise Daily Statement</h3>
      <div className="grid">{d.rows.map(c => <div className="card campcard" key={c._id}>
        <div className="line"><b>🏫 {c.name}</b><span className="tag">{c.students} students</span></div>
        <div className="line"><span>Fees received</span><b className="g">{Rs(c.income)}</b></div>
        <div className="line"><span>Expenses</span><b>{Rs(c.expenses)}</b></div>
        <div className="line"><span>Salaries paid</span><b>{Rs(c.salaries)}</b></div>
        <div className="line total"><b>{c.left < 0 ? 'Loss' : 'Left'}</b><b className={c.left < 0 ? 'r' : 'g'}>{Rs(Math.abs(c.left))}</b></div>
        <div className="line"><span>Fees pending ({c.pendingCount})</span><b className="r">{Rs(c.pending)}</b></div>
        <div className="line"><span>Month left ({c.month.month})</span><b className={c.month.net < 0 ? 'r' : 'g'}>{Rs(c.month.net)}</b></div>
        <button className="btn sm" onClick={() => onOpen(c)}>Open this campus →</button>
      </div>)}</div>
    </>}
  </>);
}

export function CampusLogins() {
  const [list, load] = useLoad('/campuses'), [f, setF] = useState({}), [msg, setMsg] = useState('');
  const set = (id, k, v) => setF({ ...f, [id]: { ...f[id], [k]: v } });
  const save = async c => {
    const x = f[c._id] || {}; setMsg('');
    try { await api(`/campuses/${c._id}/account`, { method: 'PUT', body: { email: x.email ?? c.login, password: x.password || '' } }); setMsg(c.name + ': login saved.'); setF({ ...f, [c._id]: {} }); load(); }
    catch (e) { setMsg(c.name + ': ' + e.message); }
  };
  return (<>
    <h2>Campus Logins</h2>
    <p className="muted">Each campus has its own login and can only see its own data.</p>
    {msg && <div className={msg.includes('saved') ? 'ok' : 'err'}>{msg}</div>}
    <div className="grid">{list.map(c => <div className="card" key={c._id}>
      <div className="line"><b>🏫 {c.name}</b><span className={'chip ' + (c.login ? 'p' : 'u')}>{c.login ? 'Login ready' : 'No login yet'}</span></div>
      <label>Email<input type="email" placeholder="campus email" value={f[c._id]?.email ?? c.login} onChange={e => set(c._id, 'email', e.target.value)} /></label>
      <label>{c.login ? 'New password (leave empty to keep)' : 'Password (min 6 characters)'}<input type="text" autoComplete="off" value={f[c._id]?.password || ''} onChange={e => set(c._id, 'password', e.target.value)} /></label>
      <button className="btn sm" onClick={() => save(c)}>Save login</button>
    </div>)}</div>
  </>);
}
