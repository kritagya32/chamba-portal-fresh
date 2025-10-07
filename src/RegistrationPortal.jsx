/* RegistrationPortal.jsx — updated for your requested features
   Copy this into src/RegistrationPortal.jsx (replace the previous component).
   It expects a runtime env: GOOGLE_SCRIPT_URL (Vite: import.meta.env.VITE_GOOGLE_SCRIPT_URL
   or runtime window.__ENV setting). */

import React, { useState } from 'react';

const TEAM_COUNT = 13;
const MAX_PARTICIPANTS_PER_TEAM = 80; // new team max
const MAX_SPORTS_PER_PARTICIPANT = 3; // uniform for all
const SPORTS = [
  '100 m','200 m','400 m','800 m','1500 m','5000 m','4x100 m relay',
  'Long Jump','High Jump','Triple Jump','Discuss Throw','Shotput','Javelin throw',
  '400 m walking','800 m walking',
  'Squash','Chess','Carrom (Singles)','Carrom (Doubles)',
  'Table Tennis (Singles)','Table Tennis (Doubles)','Table Tennis (Mixed Doubles)',
  'Badminton (Singles)','Badminton (Doubles)','Badminton (Mixed Doubles)',
  'Volleyball (Men)','Kabaddi (Men)','Basketball (Men)','Tug of War','Football','Lawn Tennis','Quiz'
];

const DESIGNATIONS = [
  'CCF and above',
  'CF',
  'DCF/DFO',
  'RFO',
  'Block Officer/Forest Guard',
  'Ministerial Staff',
  'Others'
];

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const TEAM_CREDENTIALS = Array.from({ length: TEAM_COUNT }, (_, i) => ({ username: `manager_team${i+1}`, password: `Cham@Team${i+1}` }));
const ADMIN_CREDENTIALS = [
  { username: 'admin1', password: 'Chamba@Admin1' },
  { username: 'admin2', password: 'Chamba@Admin2' },
  { username: 'admin3', password: 'Chamba@Admin3' }
];

const GOOGLE_SCRIPT_URL = (typeof window !== 'undefined' && (window.__ENV && window.__ENV.VITE_GOOGLE_SCRIPT_URL)) ? window.__ENV.VITE_GOOGLE_SCRIPT_URL
  : (typeof import !== 'undefined' && import.meta && import.meta.env && import.meta.env.VITE_GOOGLE_SCRIPT_URL) ? import.meta.env.VITE_GOOGLE_SCRIPT_URL
  : '/api/proxy'; // fallback to proxy relative path

function computeAgeClass(gender, age) {
  const g = (gender || '').toLowerCase();
  const a = Number(age) || 0;
  if (g === 'male') {
    if (a >= 53) return 'Men Senior Veteran';
    if (a >= 45) return 'Men Veteran';
    return 'Men Open';
  }
  if (g === 'female') {
    if (a >= 40) return 'Women Veteran';
    return 'Women Open';
  }
  return 'Open';
}

export default function RegistrationPortal() {
  const [team, setTeam] = useState(1);
  const [participants, setParticipants] = useState([]);
  const [slotsToCreate, setSlotsToCreate] = useState(10);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedTeam, setLoggedTeam] = useState(null);
  const [adminUser, setAdminUser] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [allData, setAllData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [teamCounts, setTeamCounts] = useState(null);

  function setMsg(type, text) { setMessage({ type, text }); setTimeout(()=>setMessage(null), 8000); }

  // helper - fetch all rows (for counts / admin)
  async function fetchAllRaw() {
    const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=export`, { method: 'GET', mode: 'cors' });
    const txt = await res.text();
    if (!res.ok) throw new Error(`Export failed ${res.status}: ${txt}`);
    try { return JSON.parse(txt); } catch(e) { throw new Error('Invalid JSON from export'); }
  }

  // get current team count
  async function getTeamCount(tnum) {
    // Use export and count rows, or apps script action=count (if implemented)
    try {
      const data = await fetchAllRaw();
      const cnt = data.filter(r => String(r.teamNumber || r.team || '').includes(String(tnum))).length;
      return cnt;
    } catch (err) {
      console.error('getTeamCount error', err);
      throw err;
    }
  }

  // Create slots after checking team limit
  async function createSlots(n) {
    if (!isLoggedIn || isAdmin) { setMsg('error','Only logged-in team managers can create slots.'); return; }
    if (loggedTeam !== team) { setMsg('error', `You are logged in as Team ${loggedTeam}. Switch to Team ${team} to add slots.`); return; }

    const want = Math.max(0, Math.min(Number(n) || 0, MAX_PARTICIPANTS_PER_TEAM));
    try {
      const current = await getTeamCount(team);
      if (current + want > MAX_PARTICIPANTS_PER_TEAM) {
        setMsg('error', `Cannot add ${want} slots. Team already has ${current} players. Max allowed per team is ${MAX_PARTICIPANTS_PER_TEAM}.`);
        return;
      }
      const slots = Array.from({ length: want }, () => ({
        name:'', gender:'', age:'', designation:'', phone:'', sports: Array.from({length: MAX_SPORTS_PER_PARTICIPANT}).map(()=>''), diet:'Veg', bloodType:'', ageClass:'', photoFile: null, photoBase64:'', photoName:''
      }));
      setParticipants(prev => [...prev, ...slots]);
      setMsg('info', `Created ${want} slots. Team now can submit these players.`);

    } catch (err) {
      setMsg('error', 'Unable to check team count: ' + err.message);
    }
  }

  function updateParticipant(i, field, value) {
    setParticipants(prev => prev.map((r, idx) => idx===i ? { ...r, [field]: value } : r));
  }

  function updateSport(i, si, value) {
    setParticipants(prev => prev.map((r, idx) => {
      if (idx !== i) return r;
      const sports = Array.isArray(r.sports) ? [...r.sports] : Array.from({length:MAX_SPORTS_PER_PARTICIPANT}).map(()=>'');
      sports[si] = value;
      return { ...r, sports };
    }));
  }

  // handle file input -> convert to base64
  function handlePhotoFile(i, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(',')[1]; // remove data:...;base64,
      setParticipants(prev => prev.map((r, idx) => idx===i ? { ...r, photoFile: file, photoBase64: base64, photoName: file.name } : r));
    };
    reader.readAsDataURL(file);
  }

  // Basic validation
  function validateAll() {
    if (!isLoggedIn || isAdmin) { setMsg('error','Only logged-in managers can submit.'); return false; }
    if (loggedTeam !== team) { setMsg('error', `You are manager for Team ${loggedTeam}. Switch to Team ${team}.`); return false; }
    if (!participants || participants.length === 0) { setMsg('error','No participant slots created.'); return false; }
    for (let i=0;i<participants.length;i++){
      const p = participants[i];
      if (!p.name || !p.name.trim()) { setMsg('error', `Participant ${i+1}: name required.`); return false; }
      if (!p.age || isNaN(Number(p.age)) || Number(p.age)<=0) { setMsg('error', `Participant ${i+1}: valid age required.`); return false; }
      if (!p.phone || !/^[0-9]{6,15}$/.test((p.phone||'').trim())) { setMsg('error', `Participant ${i+1}: enter valid phone.`); return false; }
      const sel = (Array.isArray(p.sports)? p.sports.filter(Boolean).slice(0,MAX_SPORTS_PER_PARTICIPANT) : []);
      if (sel.length === 0) { setMsg('error', `Participant ${i+1}: select at least 1 sport.`); return false; }
      if (sel.length > MAX_SPORTS_PER_PARTICIPANT) { setMsg('error', `Participant ${i+1}: max ${MAX_SPORTS_PER_PARTICIPANT} sports allowed.`); return false; }
      const uniq = Array.from(new Set(sel));
      if (uniq.length !== sel.length) { setMsg('error', `Participant ${i+1}: duplicate sports selected.`); return false; }
      if (!p.bloodType || !BLOOD_TYPES.includes(p.bloodType)) { setMsg('error', `Participant ${i+1}: select blood type.`); return false; }
      if (!p.designation || !DESIGNATIONS.includes(p.designation)) { setMsg('error', `Participant ${i+1}: select designation.`); return false; }
      // compute age class
      p.ageClass = computeAgeClass(p.gender, p.age);
    }
    return true;
  }

  async function submitAll(e) {
    if (e && e.preventDefault) e.preventDefault();
    setMessage(null);
    if (!validateAll()) return;
    setLoading(true);

    // check team count again (to avoid race)
    try {
      const current = await getTeamCount(team);
      if (current + participants.length > MAX_PARTICIPANTS_PER_TEAM) {
        setMsg('error', `Submitting ${participants.length} would exceed team limit. Team currently has ${current} players. Max ${MAX_PARTICIPANTS_PER_TEAM}.`);
        setLoading(false);
        return;
      }
    } catch (err) {
      setMsg('error', 'Unable to verify current team count before submit: ' + err.message);
      setLoading(false);
      return;
    }

    const payload = {
      team: `Team ${team}`,
      teamNumber: team,
      manager: username,
      timestamp: new Date().toISOString(),
      participants: participants.map(p => ({
        name: p.name,
        gender: p.gender,
        age: p.age,
        ageClass: computeAgeClass(p.gender, p.age),
        designation: p.designation,
        phone: p.phone,
        sports: (Array.isArray(p.sports) ? p.sports.filter(Boolean).slice(0,MAX_SPORTS_PER_PARTICIPANT) : []),
        diet: p.diet || 'Veg',
        bloodType: p.bloodType || '',
        photoBase64: p.photoBase64 || '', // base64 string (no data: prefix)
        photoName: p.photoName || '',
      }))
    };

    try {
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      if (!res.ok) {
        console.error('submit error', res.status, text);
        setMsg('error', `Submission failed: server ${res.status}. See console.`); setLoading(false); return;
      }
      let data;
      try { data = JSON.parse(text); } catch(err) { console.error('json parse', text); setMsg('error','Invalid JSON response from server.'); setLoading(false); return; }
      setMsg('success', data.message || 'Submitted successfully.');
      setParticipants([]);
    } catch (err) {
      console.error('submit catch', err);
      setMsg('error', 'Submission failed: ' + (err.message || 'network error'));
    } finally {
      setLoading(false);
    }
  }

  // Admin: fetch all and compute team counts
  async function fetchAllRegistrations() {
    setLoadingData(true);
    try {
      const data = await fetchAllRaw();
      setAllData(data);
      // compute counts by teamNumber
      const counts = {};
      data.forEach(r => {
        const tnum = String(r.teamNumber || r.team || '').replace(/\D/g,'') || String(r.teamNumber || r.team || '');
        const key = tnum || (r.team || 'Unknown');
        counts[key] = (counts[key] || 0) + 1;
      });
      setTeamCounts(counts);
      setMsg('success', 'Fetched data and computed team counts.');
    } catch (err) {
      console.error('fetchAll error', err);
      setMsg('error', 'Fetch failed: ' + err.message);
    } finally { setLoadingData(false); }
  }

  function handleLogin(e) {
    if (e && e.preventDefault) e.preventDefault();
    setMessage(null);
    const adminIdx = ADMIN_CREDENTIALS.findIndex(c => c.username === username && c.password === password);
    if (adminIdx !== -1) { setIsLoggedIn(true); setIsAdmin(true); setAdminUser(ADMIN_CREDENTIALS[adminIdx].username); setLoggedTeam(null); setMsg('success','Logged in as admin'); return; }
    const teamIdx = TEAM_CREDENTIALS.findIndex(c => c.username === username && c.password === password);
    if (teamIdx === -1) { setMsg('error','Invalid username/password'); return; }
    setIsLoggedIn(true); setIsAdmin(false); setLoggedTeam(teamIdx + 1); setTeam(teamIdx + 1); setMsg('success', `Logged in as ${username} (Team ${teamIdx+1})`);
  }

  function logout() { setIsLoggedIn(false); setIsAdmin(false); setLoggedTeam(null); setUsername(''); setPassword(''); setParticipants([]); setMsg('info','Logged out'); }

  // Render
  return (
    <div style={{ padding:20, fontFamily:'Arial, sans-serif' }}>
      <h1>Chamba Sports Meet — Registration Portal</h1>

      {!isLoggedIn ? (
        <form onSubmit={handleLogin} style={{ marginBottom:12 }}>
          <input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} /> {' '}
          <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} /> {' '}
          <button type="submit">Login</button>
        </form>
      ) : (
        <div style={{ marginBottom:12 }}>
          <div>Logged in as: {isAdmin ? adminUser : username} {isAdmin ? '(Admin)' : `(Team ${loggedTeam})`}</div>
          <button onClick={logout}>Logout</button>
        </div>
      )}

      {!isAdmin && isLoggedIn && (
        <>
          <div style={{ marginBottom:10 }}>
            <label>Team:
              <select value={team} onChange={e=>setTeam(Number(e.target.value))}>
                {Array.from({length:TEAM_COUNT}).map((_,i)=> <option key={i} value={i+1}>{i+1}</option>)}
              </select>
            </label>
            <label style={{ marginLeft:10 }}>Slots to add:
              <input type="number" min="1" max="80" value={slotsToCreate} onChange={e=>setSlotsToCreate(Number(e.target.value))} style={{ width:70 }} />
            </label>
            <button onClick={()=>createSlots(slotsToCreate)} style={{ marginLeft:10 }}>Create slots (up to team max 80)</button>
          </div>

          <form onSubmit={submitAll}>
            {participants.length === 0 && <div>No slots. Create slots to add participants.</div>}

            {participants.map((p,i) => (
              <div key={i} style={{ border:'1px solid #ccc', padding:10, marginBottom:10 }}>
                <div><strong>Participant {i+1}</strong></div>
                <div style={{ display:'flex', gap:8, marginTop:6 }}>
                  <input placeholder="Full name" value={p.name} onChange={e=>updateParticipant(i,'name',e.target.value)} />
                  <select value={p.gender} onChange={e=>updateParticipant(i,'gender',e.target.value)}>
                    <option value="">Gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                  <input placeholder="Age" value={p.age} onChange={e=>updateParticipant(i,'age',e.target.value)} style={{ width:80 }} />
                  <select value={p.designation} onChange={e=>updateParticipant(i,'designation',e.target.value)}>
                    <option value="">Designation</option>
                    {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div style={{ marginTop:8 }}>
                  <input placeholder="Phone" value={p.phone} onChange={e=>updateParticipant(i,'phone',e.target.value)} />
                  <select value={p.bloodType} onChange={e=>updateParticipant(i,'bloodType',e.target.value)} style={{ marginLeft:8 }}>
                    <option value="">Blood Type</option>
                    {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                  </select>
                  <label style={{ marginLeft:8 }}>
                    Diet:
                    <select value={p.diet || 'Veg'} onChange={e=>updateParticipant(i,'diet',e.target.value)}>
                      <option>Veg</option>
                      <option>Non-Veg</option>
                    </select>
                  </label>
                </div>

                <div style={{ marginTop:8 }}>
                  <div>Choose up to {MAX_SPORTS_PER_PARTICIPANT} sports:</div>
                  <div style={{ display:'flex', gap:8, marginTop:6 }}>
                    {Array.from({length: MAX_SPORTS_PER_PARTICIPANT}).map((_, si) => (
                      <select key={si} value={(p.sports && p.sports[si]) || ''} onChange={e=>updateSport(i, si, e.target.value)}>
                        <option value="">Select</option>
                        {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop:8 }}>
                  <label>Passport photo (jpg/png): <input type="file" accept="image/*" onChange={e=>handlePhotoFile(i, e.target.files[0])} /></label>
                  {p.photoName && <span style={{ marginLeft:8 }}>{p.photoName}</span>}
                </div>
              </div>
            ))}

            <div>
              <button type="submit" disabled={loading}>{loading ? 'Submitting...' : `Submit all ${participants.length} participants`}</button>
            </div>
          </form>
        </>
      )}

      {isAdmin && (
        <div>
          <h3>Admin Dashboard</h3>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={fetchAllRegistrations}>Fetch all registrations + compute counts</button>
            <button onClick={()=>{ if (allData && allData.length>0) { const csv = convertToCSV(allData); downloadCSV(csv, 'all_registrations.csv'); } }}>Download CSV</button>
          </div>

          {loadingData && <div>Loading...</div>}

          {teamCounts && (
            <div style={{ marginTop:12 }}>
              <h4>Participants per team</h4>
              <table style={{ borderCollapse:'collapse', width:400 }}>
                <thead><tr><th style={{ border:'1px solid #ddd', padding:6 }}>Team</th><th style={{ border:'1px solid #ddd', padding:6 }}>Count</th></tr></thead>
                <tbody>
                  {Object.keys(teamCounts).sort((a,b)=>Number(a)-Number(b)).map(k => (
                    <tr key={k}><td style={{ border:'1px solid #eee', padding:6 }}>{k}</td><td style={{ border:'1px solid #eee', padding:6 }}>{teamCounts[k]}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {allData && allData.length > 0 && (
            <div style={{ marginTop:12, maxHeight:300, overflow:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{Object.keys(allData[0]).map(h => <th key={h} style={{ border:'1px solid #ddd', padding:6 }}>{h}</th>)}</tr></thead>
                <tbody>
                  {allData.map((row, idx) => (
                    <tr key={idx}>
                      {Object.keys(allData[0]).map(k => <td key={k} style={{ border:'1px solid #eee', padding:6 }}>{String(row[k]||'')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {message && <div style={{ marginTop:12, padding:8, borderRadius:6, background: message.type==='error' ? '#fee2e2' : message.type==='info' ? '#eef2ff' : '#ecfccb' }}>{message.text}</div>}
    </div>
  );
}

// small helpers for admin CSV export
function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  const header = Object.keys(data[0]);
  const rows = data.map(r => header.map(h => `"${String(r[h]||'').replace(/"/g,'""')}"`).join(','));
  return [header.join(','), ...rows].join('\n');
}
function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
