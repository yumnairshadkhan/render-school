import { useEffect, useState } from 'react';
import { api } from './api.js';
import { Dashboard, Students, Vouchers, Expenses, Teachers, Overview, CampusLogins } from './pages.jsx';

// Karachi Cambridge School ka apna naam heading mein aata hai (koi sub-heading nahi)
const isKCS = name => /cambridge/i.test(name || '');
const Brand = ({ big, side, sub, campus }) => side ? (
  <div className="sbrand"><div className="logo">🏫</div>
    <div>{isKCS(campus) ? <h1>Karachi Cambridge School (KCS)</h1> : <><h1>Sir Adam Jee Schooling System</h1>{sub && <p>{sub}</p>}</>}</div></div>
) : (
  <div className={'brand' + (big ? ' big' : '')}><div className="logo">🏫</div>
    {isKCS(campus) ? <h1>Karachi Cambridge School (KCS)</h1> : <><h1>Sir Adam Jee Schooling System</h1>{sub && <p>{sub}</p>}</>}</div>
);

const Credit = () => <footer className="credit noprint"><span>Built with care by <b>Yumna Irshad</b></span></footer>;

function Auth({ onDone, notice }) {
  const [setup, setSetup] = useState(null), [f, setF] = useState({ name: '', email: '', phone: '', password: '' }), [err, setErr] = useState(notice || '');
  const [down, setDown] = useState(''), [n, setN] = useState(0);
  useEffect(() => { setDown(''); api('/auth/status').then(d => setSetup(d.setupNeeded)).catch(e => setDown(e.message)); }, [n]);
  const submit = async e => {
    e.preventDefault(); setErr('');
    try { const d = await api(setup ? '/auth/setup' : '/auth/login', { method: 'POST', body: f }); localStorage.setItem('t', d.token); onDone(d); }
    catch (x) { setErr(x.message); }
  };
  const set = k => e => setF({ ...f, [k]: e.target.value });
  if (setup === null && !down) return <div className="center">Loading...</div>;
  return (
    <div className="center"><form className="card auth" onSubmit={submit}>
      <Brand big />
      <h3>{setup ? 'Create Director Account' : 'Login'}</h3>
      {down && <div className="err">{down}<br /><button type="button" className="btn ghost sm" onClick={() => setN(n + 1)}>Retry</button></div>}
      {setup && <input placeholder="Full Name" value={f.name} onChange={set('name')} />}
      <input type="email" placeholder="Email" required value={f.email} onChange={set('email')} />
      {setup && <input type="tel" placeholder="Phone Number" required value={f.phone} onChange={set('phone')} />}
      <input type="password" placeholder="Password" required value={f.password} onChange={set('password')} />
      {err && <div className="err">{err}</div>}
      <button className="btn">{setup ? 'Create Account' : 'Login'}</button>
      <Credit />
    </form></div>
  );
}

function ChangeAccount({ me, onClose, onEmail }) {
  const [f, setF] = useState({ current: '', email: me.email || '', password: '', again: '' }), [err, setErr] = useState(''), [ok, setOk] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const submit = async e => {
    e.preventDefault(); setErr('');
    if (f.password && f.password !== f.again) return setErr('New passwords do not match');
    try {
      const d = await api('/auth/account', { method: 'PUT', body: { current: f.current, email: f.email, password: f.password } });
      localStorage.setItem('t', d.token); onEmail(d.email); setOk(true);
    } catch (x) { setErr(x.message); }
  };
  return (
    <form className="card form" style={{ maxWidth: 420, margin: '10px auto' }} onSubmit={submit}>
      <h3>👤 My Account</h3>
      {ok ? <><div className="ok">Account updated.{f.password ? ' Other devices have been logged out.' : ''}</div><button type="button" className="btn" onClick={onClose}>Close</button></> : <>
        <label>Email<input type="email" required value={f.email} onChange={set('email')} /></label>
        <label>New password (leave empty to keep)<input type="password" placeholder="min 6 characters" value={f.password} onChange={set('password')} /></label>
        {f.password && <input type="password" placeholder="New password again" value={f.again} onChange={set('again')} />}
        <label>Current password (required to save)<input type="password" required value={f.current} onChange={set('current')} /></label>
        {err && <div className="err">{err}</div>}
        <div className="acts"><button className="btn">Save</button><button type="button" className="btn ghost" onClick={onClose}>Cancel</button></div></>}
    </form>
  );
}

const CAMPUS_TABS = [['dash', '📊 Dashboard', Dashboard], ['students', '🎓 Students', Students], ['fees', '🧾 Fee Vouchers', Vouchers], ['exp', '💸 Daily Expenses', Expenses], ['teach', '👩‍🏫 Teachers & Salary', Teachers]];

export default function App() {
  const [me, setMe] = useState(null), [chk, setChk] = useState(!!localStorage.getItem('t')), [tab, setTab] = useState('dash'), [notice, setNotice] = useState('');
  const [menu, setMenu] = useState(false), [pw, setPw] = useState(false), [campuses, setCampuses] = useState([]), [sel, setSel] = useState(localStorage.getItem('campus') || '');
  const isDir = me?.role === 'director';
  const start = d => {
    // campus wale ka campus fix hai; director ke liye pehle koi campus chuna hua nahi
    if (d.role === 'campus') { localStorage.setItem('campus', d.campus._id); localStorage.setItem('campusName', d.campus.name); setSel(d.campus._id); setTab('dash'); }
    else { setTab(localStorage.getItem('campus') ? 'dash' : 'all'); }
    setNotice(''); setMe(d);
  };
  useEffect(() => { const h = e => { setMe(null); setNotice(e.detail || ''); }; window.addEventListener('loggedout', h); return () => window.removeEventListener('loggedout', h); }, []);
  useEffect(() => { if (chk) api('/auth/me').then(start).catch(e => { if (!e.network) localStorage.removeItem('t'); }).finally(() => setChk(false)); }, []);
  useEffect(() => { if (isDir) api('/campuses').then(l => { setCampuses(l); const c = l.find(x => x._id === localStorage.getItem('campus')); if (c) localStorage.setItem('campusName', c.name); else { localStorage.removeItem('campus'); localStorage.removeItem('campusName'); setSel(''); } }).catch(() => {}); }, [isDir]);
  if (chk) return <div className="center">Loading...</div>;
  if (!me) return <Auth onDone={start} notice={notice} />;
  const choose = (id, name) => {
    if (id) { localStorage.setItem('campus', id); localStorage.setItem('campusName', name); setSel(id); setTab('dash'); }
    else { localStorage.removeItem('campus'); localStorage.removeItem('campusName'); setSel(''); setTab('all'); }
  };
  const selName = campuses.find(c => c._id === sel)?.name || '';
  const tabs = isDir ? [['all', '🏫 All Campuses', null], ['logins', '🔑 Campus Logins', null], ...(sel ? CAMPUS_TABS : [])] : CAMPUS_TABS;
  const cur = tabs.find(t => t[0] === tab) || tabs[0];
  const sub = isDir ? (sel && cur[0] !== 'all' && cur[0] !== 'logins' ? selName : 'Director · All Campuses') : me.campus?.name;
  let page;
  if (cur[0] === 'all') page = <Overview onOpen={c => choose(c._id, c.name)} />;
  else if (cur[0] === 'logins') page = <CampusLogins />;
  else { const Page = cur[2]; page = <Page key={sel} />; }
  const logout = async () => { try { await api('/auth/logout', { method: 'POST' }); } catch {} localStorage.clear(); setMe(null); setSel(''); };
  const brandCampus = isDir ? (cur[0] === 'all' || cur[0] === 'logins' ? '' : selName) : me.campus?.name;
  return (
    <div className="shell">
      <div className={'backdrop noprint' + (menu ? ' show' : '')} onClick={() => setMenu(false)} />
      <aside className={'side noprint' + (menu ? ' open' : '')}>
        <button className="sclose" onClick={() => setMenu(false)} aria-label="Close menu">✕</button>
        <Brand side sub={sub} campus={brandCampus} />
        <nav className="snav">{tabs.map(([k, l]) => { const [ic, ...rest] = l.split(' '); return <button key={k} className={cur[0] === k ? 'on' : ''} onClick={() => { setTab(k); setMenu(false); }}><i>{ic}</i><span>{rest.join(' ')}</span></button>; })}</nav>
        <div className="sfoot"><button onClick={() => { setPw(!pw); setMenu(false); }}><i>👤</i><span>Account</span></button><button onClick={() => { setMenu(false); logout(); }}><i>🚪</i><span>Logout</span></button></div>
      </aside>
      <div className="mainarea">
        <header className="topbar noprint">
          <button className="burger" onClick={() => setMenu(true)} aria-label="Open menu">☰</button>
          {isDir ? <div className="cbar2"><span>Open campus</span>
            <select value={sel} onChange={e => choose(e.target.value, campuses.find(c => c._id === e.target.value)?.name)}>
              <option value="">— All campuses overview —</option>{campuses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
            : <div className="cbar2"><span>🏫 {me.campus?.name}</span></div>}
          <div className="uchip"><i className="uav">{(me.name || '?').trim()[0]}</i><span><b>{me.name}</b><small>{isDir ? 'Director' : 'Campus'}</small></span></div>
        </header>
        <main className="wrap">{pw && <ChangeAccount me={me} onClose={() => setPw(false)} onEmail={em => setMe({ ...me, email: em })} />}{page}</main>
        <Credit />
      </div>
    </div>
  );
}
