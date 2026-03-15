// ─── Supabase config ──────────────────────────────────────────────────────────
// Replace these two values with your own from the Supabase dashboard
// (Project Settings → API)
const SUPABASE_URL = 'https://vzwifrzgpmgylvuvvtjv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6d2lmcnpncG1neWx2dXZ2dGp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMjUxOTgsImV4cCI6MjA4ODkwMTE5OH0.mCRnsFXwv8g6vEBtthuyKiEBTXIGoyZ8OWPM6-Egkrw';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = ['#f0c430','#e05c2a','#2ecc71','#3498db','#9b59b6','#e74c3c','#1abc9c','#f39c12','#e91e63','#00bcd4'];

let _courtTeams = {}; // pid -> 0 (none) | 1 (team1) | 2 (team2)

function cycleTeam(pid) {
  const current = _courtTeams[pid] || 0;
  let next = (current + 1) % 3;
  // Skip a team if it already has 2 players
  if (next === 1 && Object.values(_courtTeams).filter(t=>t===1).length >= 2) next = 2;
  if (next === 2 && Object.values(_courtTeams).filter(t=>t===2).length >= 2) next = 0;
  _courtTeams[pid] = next;
  const badge = document.getElementById(`tbadge-${pid}`);
  if (badge) { badge.dataset.team = next; badge.textContent = ['—','T1','T2'][next]; }
}

let state = {
  players: [],
  courts: [],
  waitingList: [],
  selectedColor: COLORS[0],
  playerSort: 'wins',
};

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function loadState() {
  showLoading(true);
  try {
    const [
      { data: players,     error: e1 },
      { data: courts,      error: e2 },
      { data: courtPlayers,error: e3 },
      { data: waitingRows, error: e4 },
      { data: scoreRows,   error: e5 },
    ] = await Promise.all([
      db.from('players').select('*').order('name'),
      db.from('courts').select('*').order('id'),
      db.from('court_players').select('*'),
      db.from('waiting_list').select('*').order('joined_at'),
      db.from('score_history').select('*').order('recorded_at'),
    ]);

    if (e1||e2||e3||e4||e5) throw (e1||e2||e3||e4||e5);

    state.players = (players || []).filter(p => !p.is_deleted).map(p => ({
      id: p.id, name: p.name, handle: p.handle, color: p.color,
      total_points: p.total_points || 0, wins: p.wins || 0, losses: p.losses || 0, photo_url: p.photo_url || null,
    }));

    state.courts = (courts || []).map(c => {
      const courtScores = (scoreRows || [])
        .filter(s => s.court_id === c.id)
        .map(s => ({
          team1: s.team1_label, team2: s.team2_label,
          score: [s.score1, s.score2],
          time: new Date(s.recorded_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
        }));
      return {
        id: c.id,
        name: c.name,
        maxPlayers: c.max_players,
        playerIds: (courtPlayers || []).filter(cp => cp.court_id === c.id).map(cp => cp.player_id),
        score: null,
        scoreHistory: courtScores,
      };
    });

    state.waitingList = (waitingRows || []).map(w => ({
      pid: w.player_id,
      joinedAt: new Date(w.joined_at).getTime(),
      dbId: w.id,
    }));


  } catch (err) {
    console.error('loadState error:', err);
    showToast('⚠️ Could not load data — check Supabase config');
  }
  showLoading(false);
  renderAll();
}

function showLoading(on) {
  let el = document.getElementById('app-loading');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-loading';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,26,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;color:#f0c430;font-size:1.1rem;font-weight:600;letter-spacing:1px;';
    el.innerHTML = '<div>Loading…</div>';
    document.body.appendChild(el);
  }
  el.style.display = on ? 'flex' : 'none';
}

// ─── Realtime sync ────────────────────────────────────────────────────────────
// Reloads state on any change — great for multi-device use at the club
db.channel('club-night-changes')
  .on('postgres_changes', { event: '*', schema: 'public' }, () => loadState())
  .subscribe();

const getPlayer = id => state.players.find(p => p.id === id);
const initials = name => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
const dicebearUrl = name => `https://api.dicebear.com/8.x/thumbs/svg?seed=${encodeURIComponent(name)}&radius=50&backgroundColor=transparent`;

function renderAvatar(p, size=34) {
  const url = p.photo_url || dicebearUrl(p.name);
  return `<div class="player-avatar" style="width:${size}px;height:${size}px;border:2px solid ${p.color};overflow:hidden;background:${p.color}22;flex-shrink:0"><img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/></div>`;
}

function renderCourts() {
  document.getElementById('courts-grid').innerHTML = state.courts.map(court => {
    const slots = [];
    for (let i = 0; i < court.maxPlayers; i++) {
      const pid = court.playerIds[i];
      if (pid) {
        const p = getPlayer(pid);
        if (p) slots.push(`<div class="player-slot">${renderAvatar(p)}<div class="player-info"><div class="player-name">${p.name}</div><div class="player-since">Playing now</div></div><button class="remove-btn" title="Move to waiting list" onclick="moveToWaitlist(${court.id},${pid})">✕</button></div>`);
      } else {
        slots.push(`<div class="empty-slot"><div class="slot-circle">+</div>Open slot</div>`);
      }
    }
    const isFull = court.playerIds.length >= court.maxPlayers;
    const isActive = court.playerIds.length > 0;
    const finishBtn = isActive ? `<button class="finish-btn" onclick="gameFinished(${court.id})">🏁 Game Finished</button>` : '';

    // Split players into two teams
    const half = Math.ceil(court.playerIds.length / 2);
    const team1 = court.playerIds.slice(0, half);
    const team2 = court.playerIds.slice(half);
    const teamLabel = (ids) => ids.map(id => getPlayer(id)?.name.split(' ')[0]).filter(Boolean).join(' & ') || '—';

    // Current score display
    let scoreHtml = '';
    if (isActive) {
      const s = court.score;
      scoreHtml = `
        <div class="score-panel">
          <div class="score-teams">
            <div class="score-team">
              <div class="score-team-name">${teamLabel(team1)}</div>
              <div class="score-num">${s ? s[0] : '—'}</div>
            </div>
            <div class="score-vs">VS</div>
            <div class="score-team" style="text-align:right">
              <div class="score-team-name">${teamLabel(team2)}</div>
              <div class="score-num">${s ? s[1] : '—'}</div>
            </div>
          </div>
        </div>`;
    }

    // Score history
    let historyHtml = '';
    if (court.scoreHistory.length > 0) {
      const rows = court.scoreHistory.slice(-3).reverse().map(h =>
        `<div class="score-history-row">
          <span class="score-history-teams">${h.team1} vs ${h.team2}</span>
          <span class="score-history-result ${h.score[0] > h.score[1] ? 'win-left' : h.score[1] > h.score[0] ? 'win-right' : ''}">${h.score[0]} – ${h.score[1]}</span>
          <span class="score-history-time">${h.time}</span>
        </div>`
      ).join('');
      historyHtml = `<div class="score-history"><div class="score-history-title">Recent Results</div>${rows}</div>`;
    }

    return `<div class="court-card">
      <div class="court-header">
        <span class="court-name">${court.name}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="court-status ${isActive?'status-active':'status-empty'}">${isActive?'IN PLAY':'EMPTY'}</span>
          <button class="remove-court-btn" onclick="removeCourt(${court.id})" title="Remove court">✕</button>
        </div>
      </div>
      <div class="court-body">
        ${slots.join('')}
        ${scoreHtml}
        ${historyHtml}
        <div class="court-actions">
          ${isFull
            ? `<button class="join-btn" style="flex:1;border-color:#e74c3c;color:#e74c3c" onclick="stopGame(${court.id})">⏹ Stop Game</button>`
            : `<button class="join-btn" style="flex:1" onclick="openJoinCourt(${court.id})">+ Join Court</button>`
          }
          ${finishBtn}
        </div>
      </div>
    </div>`;
  }).join('');
  renderWaitingList();
}


function formatWaitTime(joinedAt) {
  const secs = Math.floor((Date.now() - joinedAt) / 1000);
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}m ${s.toString().padStart(2,'0')}s`;
}

function renderWaitingList() {
  const el = document.getElementById('waiting-list');
  if (!state.waitingList.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">No one waiting right now</div></div>`;
    return;
  }
  // Sort by joinedAt ascending (longest waiting first)
  const sorted = [...state.waitingList].sort((a,b) => a.joinedAt - b.joinedAt);
  el.innerHTML = sorted.map((entry, i) => {
    const p = getPlayer(entry.pid);
    if (!p) return '';
    const waitSecs = Math.floor((Date.now() - entry.joinedAt) / 1000);
    const urgent = waitSecs > 600;
    return `<div class="waiting-item">
      <div class="queue-num">${i+1}</div>
      ${renderAvatar(p)}
      <div class="player-info">
        <div class="player-name">${p.name}</div>
      </div>
      <span class="wait-time ${urgent?'urgent':''}">${formatWaitTime(entry.joinedAt)}</span>
      <button class="promote-btn" onclick="openAssignCourt(${entry.pid})">Assign</button>
      <button class="leave-btn" onclick="removeWaiting(${entry.pid})">Leave Queue</button>
    </div>`;
  }).join('');
}

async function moveToWaitlist(courtId, pid) {
  const playerName = getPlayer(pid)?.name;
  // Optimistic update
  const court = state.courts.find(c => c.id === courtId);
  court.playerIds = court.playerIds.filter(id => id !== pid);
  if (!state.waitingList.some(e => e.pid === pid)) {
    state.waitingList.push({ pid, joinedAt: Date.now() });
  }
  renderCourts();
  showToast(`${playerName} moved to waiting list ⏳`);
  // Persist
  await db.from('court_players').delete().eq('court_id', courtId).eq('player_id', pid);
  if (!( await db.from('waiting_list').select('id').eq('player_id', pid).maybeSingle() ).data) {
    await db.from('waiting_list').insert({ player_id: pid });
  }
}

async function removeFromCourt(courtId, pid) {
  state.courts.find(c=>c.id===courtId).playerIds = state.courts.find(c=>c.id===courtId).playerIds.filter(id=>id!==pid);
  renderCourts();
  await db.from('court_players').delete().eq('court_id', courtId).eq('player_id', pid);
}

async function removeWaiting(pid) {
  state.waitingList = state.waitingList.filter(e=>e.pid!==pid);
  renderWaitingList();
  await db.from('waiting_list').delete().eq('player_id', pid);
}

function openAssignCourt(pid) {
  openModal('assign-court', { pid });
}

async function promoteWaiting(pid) {
  const select = document.getElementById('inp-assign-court');
  const courtId = parseInt(select?.value);
  const court = state.courts.find(c => c.id === courtId);
  if (!court || court.playerIds.length >= court.maxPlayers) { showToast("Please select a court with an open slot!"); return; }
  // Optimistic
  state.waitingList = state.waitingList.filter(e => e.pid !== pid);
  court.playerIds.push(pid);
  closeModal();
  renderCourts();
  showToast(`${getPlayer(pid).name} moved to ${court.name}!`);
  // Persist
  await db.from('waiting_list').delete().eq('player_id', pid);
  await db.from('court_players').upsert({ court_id: courtId, player_id: pid });
}

function gameFinished(courtId) {
  // Opens a score entry modal; the actual finish happens after score is saved
  openModal('game-finished-score', { courtId });
}

async function finaliseGame(courtId) {
  const s1 = parseInt(document.getElementById('inp-score1').value) || 0;
  const s2 = parseInt(document.getElementById('inp-score2').value) || 0;
  const court = state.courts.find(c => c.id === courtId);
  if (!court) return;

  // Determine teams
  const half = Math.ceil(court.playerIds.length / 2);
  const team1Ids = court.playerIds.slice(0, half);
  const team2Ids = court.playerIds.slice(half);
  const team1Label = team1Ids.map(id => getPlayer(id)?.name.split(' ')[0]).filter(Boolean).join(' & ') || 'Team 1';
  const team2Label = team2Ids.map(id => getPlayer(id)?.name.split(' ')[0]).filter(Boolean).join(' & ') || 'Team 2';

  // Determine winner ids
  const winnerIds = s1 > s2 ? team1Ids : s2 > s1 ? team2Ids : [];

  const playersCopy = [...court.playerIds];
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Update score history in state
  court.scoreHistory.push({ team1: team1Label, team2: team2Label, score: [s1, s2], time: timeStr });
  court.score = null;
  court.playerIds = [];

  // Optimistic: move players to waiting list
  playersCopy.forEach(pid => {
    if (!state.waitingList.some(e => e.pid === pid)) {
      state.waitingList.push({ pid, joinedAt: Date.now() });
    }
  });

  closeModal();
  renderCourts();

  const winner = s1 > s2 ? team1Label : s2 > s1 ? team2Label : null;
  showToast(winner ? `🏆 ${winner} wins ${s1}–${s2}! Players back in queue.` : `It's a draw! ${s1}–${s2}. Players back in queue.`);

  // Persist score
  await db.from('score_history').insert({
    court_id: courtId,
    team1_label: team1Label,
    team2_label: team2Label,
    score1: s1,
    score2: s2,
  });

  // Update player stats: add points (their team's score) and wins
  // Uses a raw SQL increment so values accumulate correctly even with concurrent updates
  const statsUpdates = [
    ...team1Ids.map(pid => ({ pid, pts: s1, win: s1 > s2 ? 1 : 0, loss: s1 < s2 ? 1 : 0 })),
    ...team2Ids.map(pid => ({ pid, pts: s2, win: s2 > s1 ? 1 : 0, loss: s2 < s1 ? 1 : 0 })),
  ];
  for (const { pid, pts, win, loss } of statsUpdates) {
    const p = getPlayer(pid);
    if (!p) continue;
    // Optimistically update local state
    p.total_points = (p.total_points || 0) + pts;
    p.wins = (p.wins || 0) + win;
    p.losses = (p.losses || 0) + loss;
    // Persist using raw SQL increment to avoid read-then-write race conditions
    const { error: statsErr } = await db.rpc('increment_player_stats', {
      p_id: pid,
      p_points: pts,
      p_wins: win,
      p_losses: loss,
    });
    if (statsErr) {
      console.error('Stats update failed for player', pid, statsErr);
      showToast('⚠️ Could not save player stats — check the DB migration has been run');
    }
  }

  // Write per-player game history
  for (const { pid, pts, win } of statsUpdates) {
    const isTeam1 = team1Ids.includes(pid);
    const opponentIds = isTeam1 ? team2Ids : team1Ids;
    const teammateIds = (isTeam1 ? team1Ids : team2Ids).filter(id => id !== pid);
    await db.from('player_game_history').insert({
      player_id:            pid,
      points:               pts,
      win:                  win === 1,
      team_label:           isTeam1 ? team1Label : team2Label,
      opponent_label:       isTeam1 ? team2Label : team1Label,
      opponent_player_ids:  opponentIds,
      teammate_player_ids:  teammateIds,
      score_for:            isTeam1 ? s1 : s2,
      score_against:        isTeam1 ? s2 : s1,
    });
  }

  // Remove players from court and add to waiting list
  await db.from('court_players').delete().eq('court_id', courtId);
  for (const pid of playersCopy) {
    const existing = await db.from('waiting_list').select('id').eq('player_id', pid).maybeSingle();
    if (!existing.data) {
      await db.from('waiting_list').insert({ player_id: pid });
    }
  }
}


function renderSortControls() {
  const opts = [
    { val: 'name',    label: 'Name' },
    { val: 'wins',    label: 'Wins' },
    { val: 'losses',  label: 'Losses' },
    { val: 'points',  label: 'Points' },
    { val: 'games',   label: 'Games' },
    { val: 'winpct',  label: 'Win %' },
  ];
  const el = document.getElementById('sort-controls');
  if (!el) return;
  el.innerHTML = '<div class="sort-bar"><span class="sort-bar-label">Sort by:</span>' +
    opts.map(o => '<button class="sort-btn' + (state.playerSort === o.val ? ' active' : '') + '" onclick="setSort(\'' + o.val + '\')">' + o.label + '</button>').join('') +
    '</div>';
}

function setSort(val) {
  state.playerSort = val;
  renderPlayers();
}

const MIN_RANKED_GAMES = 3;

function renderPlayers() {
  renderSortControls();
  const sortFn = {
    name:   (a, b) => a.name.localeCompare(b.name),
    wins:   (a, b) => (b.wins - a.wins) || (b.total_points - a.total_points),
    losses: (a, b) => (b.losses - a.losses) || (b.wins - a.wins),
    points: (a, b) => (b.total_points - a.total_points) || (b.wins - a.wins),
    games:  (a, b) => ((b.wins + b.losses) - (a.wins + a.losses)) || (b.wins - a.wins),
    winpct: (a, b) => {
      const pctA = (a.wins + a.losses) > 0 ? a.wins / (a.wins + a.losses) : 0;
      const pctB = (b.wins + b.losses) > 0 ? b.wins / (b.wins + b.losses) : 0;
      return (pctB - pctA) || (b.wins - a.wins);
    },
  };
  const ranked   = [...state.players].filter(p => (p.wins + p.losses) >= MIN_RANKED_GAMES);
  const unranked = [...state.players].filter(p => (p.wins + p.losses) <  MIN_RANKED_GAMES);
  const byName   = state.playerSort === 'name';
  const sorted   = byName
    ? [...state.players].sort(sortFn.name)
    : [...ranked.sort(sortFn[state.playerSort] || sortFn.wins), ...unranked.sort(sortFn.name)];
  document.getElementById('players-grid').innerHTML = sorted.map((p, i) => {
    const games = (p.wins || 0) + (p.losses || 0);
    const isRanked = games >= MIN_RANKED_GAMES;
    const rank = byName ? null : (isRanked ? ranked.indexOf(p) + 1 : null);
    const rankBadge = !isRanked ? '<span style="font-size:0.65rem;font-family:\'DM Sans\',sans-serif;color:var(--muted);font-weight:600;letter-spacing:0.5px">UNRANKED</span>'
      : rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    const avatarUrl = p.photo_url || dicebearUrl(p.name);
    const avatarHtml = `<div class="profile-avatar" style="border-color:${p.color};overflow:hidden;padding:0"><img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`;
    const winPct = games > 0 ? Math.round((p.wins / games) * 100) : 0;
    return `
    <div class="player-card">
      <div style="position:relative">
        ${avatarHtml}
        <span style="position:absolute;top:-6px;right:calc(50% - 38px);font-size:1rem">${rankBadge}</span>
      </div>
      <div class="profile-name">${p.name}</div>
      <div class="profile-handle">@${p.handle}</div>
      <div class="profile-stats">
        <div class="stat"><div class="stat-num">${p.wins}</div><div class="stat-label">Wins</div></div>
        <div class="stat"><div class="stat-num">${p.losses || 0}</div><div class="stat-label">Losses</div></div>
        <div class="stat"><div class="stat-num">${games}</div><div class="stat-label">Games</div></div>
        <div class="stat"><div class="stat-num">${winPct}%</div><div class="stat-label">Win %</div></div>
        <div class="stat"><div class="stat-num">${p.total_points}</div><div class="stat-label">Points</div></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="edit-name-btn" style="flex:1" onclick="openModal('edit-player',{pid:${p.id}})" title="Edit name">✏️ Edit</button>
        <button class="edit-name-btn" style="flex:1;color:#e74c3c" onclick="openModal('confirm-delete-player',{pid:${p.id}})" title="Delete player">🗑️ Delete</button>
      </div>
    </div>`;
  }).join('');
}


let modalMode = null, modalData = {};

function openModal(mode, data={}) {
  modalMode = mode; modalData = data;
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal-content');
  state.selectedColor = COLORS[Math.floor(Math.random()*COLORS.length)];
  _pendingPhotoUrl = null;

  if (mode === 'player') {
    modal.innerHTML = `
      <div class="modal-title">🏸 Add New Player</div>
      <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="inp-name" placeholder="e.g. Sarah Jones"/></div>
      <div class="form-group"><label class="form-label">Username</label><input class="form-input" id="inp-handle" placeholder="e.g. sarah_j"/></div>
      <div class="form-group"><label class="form-label">Avatar Colour</label>
        <div class="color-picker">${COLORS.map(c=>`<div class="color-swatch${c===state.selectedColor?' selected':''}" style="background:${c}" onclick="selectColor('${c}')"></div>`).join('')}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Photo (optional)</label>
        <div class="photo-upload-area">
          <div class="photo-preview" id="photo-preview-add">📷</div>
          <label class="photo-upload-btn" id="photo-upload-label-add">
            Tap to upload photo
            <input type="file" accept="image/*" style="display:none" onchange="handlePhotoSelect(this,'add')"/>
          </label>
        </div>
      </div>
      <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="addPlayer()">Add Player</button></div>`;
  } else if (mode === 'assign-court') {
    const p = getPlayer(data.pid);
    const openCourts = state.courts.filter(c => c.playerIds.length < c.maxPlayers);
    modal.innerHTML = `
      <div class="modal-title">Assign ${p.name}</div>
      <div class="form-group"><label class="form-label">Select Court</label>
        <select class="form-input" id="inp-assign-court">
          <option value="">-- choose court --</option>
          ${openCourts.length
            ? openCourts.map(c => `<option value="${c.id}">${c.name} — ${c.maxPlayers - c.playerIds.length} slot${c.maxPlayers - c.playerIds.length > 1 ? 's' : ''} open</option>`).join('')
            : '<option disabled>No open courts</option>'}
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" ${!openCourts.length ? 'disabled' : ''} onclick="promoteWaiting(${data.pid})">Assign</button>
      </div>`;
  } else if (mode === 'add-to-waitlist') {
    const available = state.players.filter(p =>
      !state.courts.some(c => c.playerIds.includes(p.id)) &&
      !state.waitingList.some(e => e.pid === p.id)
    );
    modal.innerHTML = `
      <div class="modal-title">⏳ Add to Waiting List</div>
      <div class="form-group">
        <label class="form-label">Select Players</label>
        <div class="multi-select-list" id="inp-waitlist-players">
          ${available.length
            ? available.map(p => `<label class="multi-select-item"><input type="checkbox" value="${p.id}"><span>${p.name}</span></label>`).join('')
            : '<div style="color:var(--muted);font-size:0.85rem;padding:8px 0">No available players</div>'}
        </div>
      </div>
      <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="addToWaitlist()">Add to Queue</button></div>`;
  } else if (mode === 'record-score') {
    const court = state.courts.find(c => c.id === data.courtId);
    const half = Math.ceil(court.playerIds.length / 2);
    const team1 = court.playerIds.slice(0, half).map(id => getPlayer(id)?.name.split(' ')[0]).filter(Boolean).join(' & ') || 'Team 1';
    const team2 = court.playerIds.slice(half).map(id => getPlayer(id)?.name.split(' ')[0]).filter(Boolean).join(' & ') || 'Team 2';
    const cur = court.score;
    modal.innerHTML = `
      <div class="modal-title">📝 Record Score — ${court.name}</div>
      <div class="score-input-grid">
        <div class="score-input-team">
          <div class="score-input-label">${team1}</div>
          <input class="score-input-num" id="inp-score1" type="number" min="0" max="99" value="${cur ? cur[0] : 0}" />
        </div>
        <div class="score-input-sep">–</div>
        <div class="score-input-team">
          <div class="score-input-label">${team2}</div>
          <input class="score-input-num" id="inp-score2" type="number" min="0" max="99" value="${cur ? cur[1] : 0}" />
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="saveScore(${data.courtId}, '${team1}', '${team2}')">Save Score</button>
      </div>`;
  } else if (mode === 'game-finished-score') {
    const court = state.courts.find(c => c.id === data.courtId);
    const half = Math.ceil(court.playerIds.length / 2);
    const team1 = court.playerIds.slice(0, half).map(id => getPlayer(id)?.name.split(' ')[0]).filter(Boolean).join(' & ') || 'Team 1';
    const team2 = court.playerIds.slice(half).map(id => getPlayer(id)?.name.split(' ')[0]).filter(Boolean).join(' & ') || 'Team 2';
    modal.innerHTML = `
      <div class="modal-title">🏁 Game Finished — ${court.name}</div>
      <p style="color:var(--muted);font-size:0.85rem;margin-bottom:18px;text-align:center">Enter the final score before players return to the queue</p>
      <div class="score-input-grid">
        <div class="score-input-team">
          <div class="score-input-label">${team1}</div>
          <input class="score-input-num" id="inp-score1" type="number" min="0" max="99" value="0" />
        </div>
        <div class="score-input-sep">–</div>
        <div class="score-input-team">
          <div class="score-input-label">${team2}</div>
          <input class="score-input-num" id="inp-score2" type="number" min="0" max="99" value="0" />
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="finaliseGame(${data.courtId})">✅ Save & Finish</button>
      </div>`;
  } else if (mode === 'edit-player') {
    const p = getPlayer(data.pid);
    modal.innerHTML = `
      <div class="modal-title">✏️ Edit Player</div>
      <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="inp-edit-name" value="${p.name}" placeholder="Player name"/></div>
      <div class="form-group">
        <label class="form-label">Photo</label>
        <div class="photo-upload-area">
          <div class="photo-preview" id="photo-preview-edit">
            <img src="${p.photo_url || dicebearUrl(p.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>
          </div>
          <label class="photo-upload-btn" id="photo-upload-label-edit">
            ${p.photo_url ? 'Change photo' : 'Tap to upload photo'}
            <input type="file" accept="image/*" style="display:none" onchange="handlePhotoSelect(this,'edit')"/>
          </label>
        </div>
      </div>
      <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="savePlayerName(${p.id})">Save</button></div>`;
  } else if (mode === 'join-court') {
    const court = state.courts.find(c=>c.id===data.courtId);
    const available = state.waitingList.map(e=>state.players.find(p=>p.id===e.pid)).filter(Boolean).filter(p=>!court.playerIds.includes(p.id));
    const slotsOpen = court.maxPlayers - court.playerIds.length;
    modal.innerHTML = `
      <div class="modal-title">Join ${court.name}</div>
      <p style="color:var(--muted);font-size:0.82rem;margin-bottom:8px">${slotsOpen} slot${slotsOpen !== 1 ? 's' : ''} available — tap to assign teams</p>
      <p style="font-size:0.78rem;margin-bottom:12px;display:flex;gap:10px;align-items:center">
        <span class="team-badge" data-team="0" style="width:28px">—</span> Unselected &nbsp;
        <span class="team-badge" data-team="1" style="width:28px">T1</span> Team 1 &nbsp;
        <span class="team-badge" data-team="2" style="width:28px">T2</span> Team 2
      </p>
      <div class="form-group">
        <label class="form-label">Waiting List</label>
        <div class="multi-select-list" id="inp-players">
          ${available.length
            ? available.map(p=>`<div class="team-select-item" onclick="cycleTeam(${p.id})"><span class="team-badge" id="tbadge-${p.id}" data-team="0">—</span><span>${p.name}</span></div>`).join('')
            : '<div style="color:var(--muted);font-size:0.85rem;padding:8px 0">No players in the waiting list</div>'}
        </div>
      </div>
      <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-primary" onclick="joinCourt(${data.courtId})">Join Court</button></div>`;
  } else if (mode === 'confirm-delete-player') {
    const p = getPlayer(data.pid);
    modal.innerHTML = `
      <div class="modal-title">Delete Player?</div>
      <p style="color:var(--muted);font-size:0.9rem;margin-bottom:16px">Are you sure you want to delete <strong style="color:var(--fg)">${p.name}</strong>? They will be hidden from all views.</p>
      <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-danger" onclick="deletePlayer(${data.pid})">Delete</button></div>`;
  } else if (mode === 'confirm-reset-stats') {
    const p = getPlayer(data.pid);
    modal.innerHTML = `
      <div class="modal-title">Reset Stats?</div>
      <p style="color:var(--muted);font-size:0.9rem;margin-bottom:16px">This will zero out all wins, losses and points for <strong style="color:var(--fg)">${p.name}</strong> and delete their full game history. This cannot be undone.</p>
      <div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Cancel</button><button class="btn-danger" onclick="resetPlayerStats(${data.pid})">Reset</button></div>`;
  }
  overlay.classList.add('open');
}

function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }
function closeModalOutside(e) { if (e.target===document.getElementById('modal-overlay')) closeModal(); }

function selectColor(c) {
  state.selectedColor = c;
  document.querySelectorAll('.color-swatch').forEach(el => el.classList.toggle('selected', el.style.background===c));
}

// Holds the uploaded photo URL between modal interaction and save
let _pendingPhotoUrl = null;

async function handlePhotoSelect(input, context) {
  const file = input.files[0];
  if (!file) return;
  const previewEl = document.getElementById(`photo-preview-${context}`);
  const labelEl   = document.getElementById(`photo-upload-label-${context}`);
  labelEl.classList.add('uploading');
  labelEl.childNodes[0].textContent = 'Uploading…';

  // Show local preview immediately
  const reader = new FileReader();
  reader.onload = e => {
    previewEl.innerHTML = `<img src="${e.target.result}"/>`;
  };
  reader.readAsDataURL(file);

  // Upload to Supabase Storage
  const ext  = file.name.split('.').pop();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await db.storage.from('player-photos').upload(path, file, { upsert: true });
  if (error) {
    showToast('⚠️ Photo upload failed: ' + error.message);
    labelEl.classList.remove('uploading');
    labelEl.childNodes[0].textContent = 'Tap to upload photo';
    _pendingPhotoUrl = null;
    return;
  }
  const { data: { publicUrl } } = db.storage.from('player-photos').getPublicUrl(path);
  _pendingPhotoUrl = publicUrl;
  labelEl.classList.remove('uploading');
  labelEl.childNodes[0].textContent = 'Photo uploaded ✓';
}

async function addPlayer() {
  const name = document.getElementById('inp-name').value.trim();
  const handle = document.getElementById('inp-handle').value.trim();
  if (!name) { showToast('Please enter a name'); return; }
  const newHandle = handle || name.toLowerCase().replace(/\s+/g,'_');
  const photoUrl = _pendingPhotoUrl || null;
  _pendingPhotoUrl = null;
  closeModal();
  const { data, error } = await db.from('players')
    .insert({ name, handle: newHandle, color: state.selectedColor, photo_url: photoUrl })
    .select().single();
  if (error) { showToast('⚠️ Could not add player: ' + error.message); return; }
  state.players.push({ id: data.id, name: data.name, handle: data.handle, color: data.color, total_points: 0, wins: 0, losses: 0, photo_url: photoUrl });
  renderAll();
  showToast(`${name} added! 🏸`);
}

async function deletePlayer(pid) {
  closeModal();
  const { error } = await db.from('players').update({ is_deleted: true }).eq('id', pid);
  if (error) { showToast('⚠️ Could not delete player: ' + error.message); return; }
  state.players = state.players.filter(p => p.id !== pid);
  state.waitingList = state.waitingList.filter(e => e.pid !== pid);
  state.courts.forEach(c => { c.playerIds = c.playerIds.filter(id => id !== pid); });
  renderAll();
  showToast('Player deleted');
}

async function savePlayerName(pid) {
  const name = document.getElementById('inp-edit-name').value.trim();
  if (!name) { showToast('Please enter a name'); return; }
  const p = getPlayer(pid);
  const photoUrl = _pendingPhotoUrl || p.photo_url || null;
  _pendingPhotoUrl = null;
  closeModal();
  p.name = name;
  p.photo_url = photoUrl;
  renderPlayers();
  const { error } = await db.from('players').update({ name, photo_url: photoUrl }).eq('id', pid);
  if (error) { showToast('⚠️ Could not save player: ' + error.message); }
  else { showToast(`${name} saved ✓`); }
}

function openRecordScore(courtId) {
  openModal('record-score', { courtId });
}

async function saveScore(courtId, team1, team2) {
  const s1 = parseInt(document.getElementById('inp-score1').value) || 0;
  const s2 = parseInt(document.getElementById('inp-score2').value) || 0;
  const court = state.courts.find(c => c.id === courtId);
  court.score = [s1, s2];
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  court.scoreHistory.push({ team1, team2, score: [s1, s2], time: timeStr });
  closeModal();
  renderCourts();
  const winner = s1 > s2 ? team1 : s2 > s1 ? team2 : null;
  showToast(winner ? `🏆 ${winner} wins ${s1}–${s2}!` : `It's a draw! ${s1}–${s2}`);
  // Persist
  await db.from('score_history').insert({
    court_id: courtId,
    team1_label: team1,
    team2_label: team2,
    score1: s1,
    score2: s2,
  });
}

async function addToWaitlist() {
  const checkboxes = document.querySelectorAll('#inp-waitlist-players input[type=checkbox]:checked');
  const pids = [...checkboxes].map(cb => parseInt(cb.value));
  if (!pids.length) { showToast('Select at least one player'); return; }
  closeModal();
  for (const pid of pids) {
    state.waitingList.push({ pid, joinedAt: Date.now() });
    await db.from('waiting_list').insert({ player_id: pid });
  }
  renderCourts();
  const names = pids.map(pid => getPlayer(pid)?.name).filter(Boolean).join(', ');
  showToast(`${names} added to waiting list ⏳`);
}

function openJoinCourt(courtId) {
  const available = state.waitingList.map(e=>state.players.find(p=>p.id===e.pid)).filter(Boolean);
  if (!available.length) { showToast("No players in the waiting list!"); return; }
  _courtTeams = {};
  openModal('join-court', { courtId });
}

async function joinCourt(courtId) {
  const team1pids = Object.entries(_courtTeams).filter(([,t])=>t===1).map(([id])=>parseInt(id));
  const team2pids = Object.entries(_courtTeams).filter(([,t])=>t===2).map(([id])=>parseInt(id));
  const pids = [...team1pids, ...team2pids];
  if (!pids.length) { showToast('Assign at least one player to a team'); return; }
  const court = state.courts.find(c=>c.id===courtId);
  const slotsOpen = court.maxPlayers - court.playerIds.length;
  closeModal();
  const toJoin = pids.slice(0, slotsOpen);
  const toWait = pids.slice(slotsOpen);
  for (const pid of toJoin) {
    court.playerIds.push(pid);
    await db.from('court_players').upsert({ court_id: courtId, player_id: pid });
  }
  for (const pid of toWait) {
    state.waitingList.push({ pid, joinedAt: Date.now() });
    await db.from('waiting_list').insert({ player_id: pid });
  }
  renderCourts();
  if (toJoin.length) {
    const names = toJoin.map(pid => getPlayer(pid)?.name).filter(Boolean).join(', ');
    showToast(`${names} joined ${court.name}!`);
  }
  if (toWait.length) {
    const names = toWait.map(pid => getPlayer(pid)?.name).filter(Boolean).join(', ');
    showToast(`${names} added to waiting list (court full)`);
  }
}


function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2800);
}

async function stopGame(courtId) {
  const court = state.courts.find(c => c.id === courtId);
  const pids = [...court.playerIds];
  // Move all players back to waiting list (optimistic)
  court.playerIds = [];
  for (const pid of pids) {
    if (!state.waitingList.some(e => e.pid === pid)) {
      state.waitingList.push({ pid, joinedAt: Date.now() });
    }
  }
  renderCourts();
  showToast('Game stopped — players returned to waiting list');
  // Persist
  await db.from('court_players').delete().eq('court_id', courtId);
  for (const pid of pids) {
    const existing = await db.from('waiting_list').select('id').eq('player_id', pid).maybeSingle();
    if (!existing.data) await db.from('waiting_list').insert({ player_id: pid });
  }
}

async function addCourt() {
  const num = state.courts.length + 1;
  const { data, error } = await db.from('courts')
    .insert({ name: `Court ${num}`, max_players: 4 })
    .select().single();
  if (error) { showToast('⚠️ Could not add court'); return; }
  state.courts.push({ id: data.id, name: data.name, maxPlayers: data.max_players, playerIds: [], score: null, scoreHistory: [] });
  renderCourts();
  showToast(`Court ${num} added! 🏟️`);
}

async function removeCourt(courtId) {
  const court = state.courts.find(c => c.id === courtId);
  const playersCopy = [...court.playerIds];
  // Optimistic
  playersCopy.forEach(pid => {
    if (!state.waitingList.some(e => e.pid === pid)) {
      state.waitingList.push({ pid, joinedAt: Date.now() });
    }
  });
  state.courts = state.courts.filter(c => c.id !== courtId);
  renderCourts();
  showToast(`${court.name} removed`);
  // Persist (court_players cascade deletes on court removal)
  for (const pid of playersCopy) {
    const existing = await db.from('waiting_list').select('id').eq('player_id', pid).maybeSingle();
    if (!existing.data) await db.from('waiting_list').insert({ player_id: pid });
  }
  await db.from('courts').delete().eq('id', courtId);
}

function fabAction() {
  const onCourts = document.getElementById('tab-courts').classList.contains('active');
  if (onCourts) openModal('add-to-waitlist');
  else openModal('player');
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', ['courts','players','history'][i]===name));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  renderAll();
}

function renderAll() { renderCourts(); renderPlayers(); renderHistoryTab(); }

function renderHistoryTab() {
  const list = document.getElementById('history-player-list');
  if (!list) return;
  list.style.display = 'block';
  const sorted = [...state.players].sort((a,b) => a.name.localeCompare(b.name));
  list.innerHTML = sorted.length
    ? sorted.map(p => `
      <div class="history-player-row" onclick="openPlayerHistory(${p.id})">
        ${renderAvatar(p, 32)}
        <div class="history-player-info">
          <div class="history-player-name">${p.name}</div>
          <div class="history-player-meta">${p.wins}W &nbsp;${p.losses}L &nbsp;${p.total_points}pts</div>
        </div>
        <span class="history-chevron">›</span>
      </div>`).join('')
    : '<div style="color:var(--muted);padding:16px 0">No players yet</div>';
  document.getElementById('history-detail').style.display = 'none';
}

async function openPlayerHistory(pid) {
  const p = getPlayer(pid);
  if (!p) return;
  const { data, error } = await db.from('player_game_history')
    .select('*').eq('player_id', pid).order('played_at', { ascending: false });
  if (error) { showToast('⚠️ Could not load history'); return; }

  const streak = calcStreak(data);
  const avgPts = data.length ? Math.round(data.reduce((s,g) => s + g.points, 0) / data.length) : 0;

  // ── Rivals & Avoided ─────────────────────────────────────────────────────
  // Build a map of opponent player id → { faced: number, beaten: number }
  const opponentStats = {}; // opponentPid → { faced, beaten }
  for (const g of data) {
    const oppIds = Array.isArray(g.opponent_player_ids) ? g.opponent_player_ids : [];
    for (const oppId of oppIds) {
      if (!opponentStats[oppId]) opponentStats[oppId] = { faced: 0, beaten: 0 };
      opponentStats[oppId].faced++;
      if (g.win) opponentStats[oppId].beaten++;
    }
  }
  // Rivals: 3 players you've beaten the fewest times (must have faced at least once)
  const rivals = state.players
    .filter(op => op.id !== pid && opponentStats[op.id])
    .map(op => ({ player: op, faced: opponentStats[op.id].faced, beaten: opponentStats[op.id].beaten }))
    .sort((a, b) => a.beaten - b.beaten || b.faced - a.faced)
    .slice(0, 3);

  // Partners: top 3 players this player has been on the same team with the most
  const teammateStats = {};
  for (const g of data) {
    const tmIds = Array.isArray(g.teammate_player_ids) ? g.teammate_player_ids : [];
    for (const tmId of tmIds) {
      teammateStats[tmId] = (teammateStats[tmId] || 0) + 1;
    }
  }
  const partners = state.players
    .filter(op => op.id !== pid && teammateStats[op.id])
    .map(op => ({ player: op, count: teammateStats[op.id] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Ghosted: 3 players (excl. self) with the fewest games played against this player
  const ghosted = state.players
    .filter(op => op.id !== pid)
    .map(op => ({ player: op, faced: opponentStats[op.id]?.faced || 0 }))
    .sort((a, b) => a.faced - b.faced)
    .slice(0, 3);

  function renderPartnersSection() {
    if (!partners.length) return `<div class="chart-empty">No team games recorded yet</div>`;
    return partners.map(({ player: op, count }) => `
      <div class="rival-row">
        ${renderAvatar(op, 32)}
        <div class="rival-info">
          <div class="rival-name">${op.name}</div>
          <div class="rival-meta">Teamed up ${count} time${count > 1 ? 's' : ''}</div>
        </div>
        <div class="rival-badge">🤝</div>
      </div>`).join('');
  }

  function renderRivalsSection() {
    if (!rivals.length) return `<div class="chart-empty">No rivals yet — get some games in! 🏸</div>`;
    return rivals.map(({ player: op, faced, beaten }) => `
      <div class="rival-row">
        ${renderAvatar(op, 32)}
        <div class="rival-info">
          <div class="rival-name">${op.name}</div>
          <div class="rival-meta">Faced ${faced} time${faced > 1 ? 's' : ''} · ${beaten} win${beaten !== 1 ? 's' : ''}</div>
        </div>
        <div class="rival-badge">😤</div>
      </div>`).join('');
  }

    function renderAvoidedSection() {
    if (!ghosted.length) return `<div class="chart-empty">No other players at the club yet</div>`;
    return ghosted.map(({ player: op, faced }) => `
      <div class="rival-row">
        ${renderAvatar(op, 32)}
        <div class="rival-info">
          <div class="rival-name">${op.name}</div>
          <div class="rival-meta">${faced === 0 ? 'Never faced as opponent' : `Faced ${faced} time${faced > 1 ? 's' : ''} as opponent`}</div>
        </div>
        <div class="rival-badge">👻</div>
      </div>`).join('');
  }
  // ─────────────────────────────────────────────────────────────────────────

  const rows = data.map(g => {
    const date = new Date(g.played_at);
    const dateStr = date.toLocaleDateString([], { day:'numeric', month:'short' });
    const timeStr = date.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    return `<div class="history-game-row">
      <div class="history-game-badge ${g.win ? 'win' : 'loss'}">${g.win ? 'W' : 'L'}</div>
      <div class="history-game-info">
        <div class="history-game-teams">${g.team_label} <span style="color:var(--muted)">vs</span> ${g.opponent_label}</div>
        <div class="history-game-meta">${dateStr} · ${timeStr}</div>
      </div>
      <div class="history-game-score">${g.score_for}–${g.score_against}</div>
    </div>`;
  }).join('') || '<div style="color:var(--muted);padding:16px 0">No games recorded yet</div>';

  document.getElementById('history-player-list').style.display = 'none';
  const detail = document.getElementById('history-detail');
  detail.style.display = 'block';
  detail.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <button class="history-back-btn" style="margin-bottom:0" onclick="document.getElementById('history-player-list').style.display='block'; document.getElementById('history-detail').style.display='none'">‹ Back</button>
      <button class="btn-danger" style="flex:unset;padding:7px 14px;font-size:0.8rem" onclick="openModal('confirm-reset-stats',{pid:${p.id}})">↺ Reset Stats</button>
    </div>
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
      ${renderAvatar(p, 48)}
      <div>
        <div class="profile-name" style="text-align:left;margin-bottom:2px">${p.name}</div>
        <div class="profile-handle" style="text-align:left">@${p.handle}</div>
      </div>
    </div>
    <div class="history-summary">
      <div class="history-stat"><div class="stat-num">${p.wins + p.losses}</div><div class="stat-label">Games</div></div>
      <div class="history-stat"><div class="stat-num">${p.wins}</div><div class="stat-label">Wins</div></div>
      <div class="history-stat"><div class="stat-num">${p.losses}</div><div class="stat-label">Losses</div></div>
      <div class="history-stat"><div class="stat-num">${streak}</div><div class="stat-label">Streak</div></div>
      <div class="history-stat"><div class="stat-num">${avgPts}</div><div class="stat-label">Avg Pts</div></div>
    </div>
    <div class="charts-section">
      <div class="chart-card">
        <div class="chart-title">📈 Wins &amp; Losses Over Time</div>
        ${data.length < 2
          ? `<div class="chart-empty">Play at least 2 games to see this chart</div>`
          : `<div class="chart-wrap"><canvas id="chart-wl"></canvas></div>`}
      </div>
      <div class="chart-card">
        <div class="chart-title">⭐ Avg Points Per Day</div>
        ${data.length < 2
          ? `<div class="chart-empty">Play at least 2 games to see this chart</div>`
          : `<div class="chart-wrap"><canvas id="chart-pts"></canvas></div>`}
      </div>
    </div>
    <div class="chart-card">
      <div class="chart-title">🤝 Partners</div>
      <div class="rivals-list">${renderPartnersSection()}</div>
    </div>
    <div class="chart-card">
      <div class="chart-title">😤 Rivals</div>
      <div class="rivals-list">${renderRivalsSection()}</div>
    </div>
    <div class="chart-card">
      <div class="chart-title">👻 Ghosted</div>
      <div class="rivals-list">${renderAvoidedSection()}</div>
    </div>
    <button class="join-btn" style="width:100%;margin-top:8px" onclick="openHistoryModal()">📋 Complete History</button>
    `;

  // Store rows for the modal to access
  window._historyModalRows = rows;
  window._historyModalName = p.name;

  if (data.length >= 2) renderPlayerCharts(data, p.color);
}

function openHistoryModal() {
  const rows = window._historyModalRows || '';
  const name = window._historyModalName || 'Player';
  const modal = document.getElementById('modal-content');
  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div class="modal-title" style="margin-bottom:0">📋 ${name} History</div>
      <button class="btn-secondary" style="padding:6px 14px" onclick="closeModal()">Close</button>
    </div>
    <div class="history-game-list" style="max-height:60vh;overflow-y:auto">${rows || '<div style="color:var(--muted);padding:16px 0">No games recorded yet</div>'}</div>`;
  document.getElementById('modal-overlay').classList.add('open');
}

async function resetPlayerStats(pid) {
  closeModal();
  const { error: e1 } = await db.from('players').update({ wins: 0, losses: 0, total_points: 0 }).eq('id', pid);
  const { error: e2 } = await db.from('player_game_history').delete().eq('player_id', pid);
  if (e1 || e2) { showToast('⚠️ Could not reset stats'); return; }
  const p = getPlayer(pid);
  if (p) { p.wins = 0; p.losses = 0; p.total_points = 0; }
  showToast(`${p?.name} stats reset`);
  await openPlayerHistory(pid);
}

function calcStreak(games) {
  if (!games.length) return '–';
  const type = games[0].win;
  let count = 0;
  for (const g of games) { if (g.win === type) count++; else break; }
  return (type ? 'W' : 'L') + count;
}

// Track chart instances so we can destroy before re-drawing
let _charts = {};

function renderPlayerCharts(games, playerColor) {
  // games come in descending order (newest first) — reverse for chronological
  const chronological = [...games].reverse();

  const labels = chronological.map((g, i) => {
    const d = new Date(g.played_at);
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  });

  // Cumulative wins & losses
  let cumWins = 0, cumLosses = 0;
  const winsData = chronological.map(g => { if (g.win) cumWins++; return cumWins; });
  const lossesData = chronological.map(g => { if (!g.win) cumLosses++; return cumLosses; });

  // Average points per day — group by date, average the points for each day
  const dayMap = {};
  for (const g of chronological) {
    const day = new Date(g.played_at).toLocaleDateString([], { day: 'numeric', month: 'short' });
    if (!dayMap[day]) dayMap[day] = { total: 0, count: 0 };
    dayMap[day].total += (g.points || 0);
    dayMap[day].count++;
  }
  const dayLabels = Object.keys(dayMap);
  const ptsData = dayLabels.map(day => Math.round((dayMap[day].total / dayMap[day].count) * 10) / 10);

  const gridColor = 'rgba(255,255,255,0.06)';
  const textColor = '#8899aa';
  const accent = playerColor || '#f0c430';

  const sharedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: textColor, font: { family: 'DM Sans', size: 11 }, boxWidth: 12 } }, tooltip: { backgroundColor: '#111827', titleColor: '#fff', bodyColor: textColor, borderColor: accent, borderWidth: 1 } },
    scales: {
      x: { ticks: { color: textColor, font: { size: 10 }, maxTicksLimit: 8 }, grid: { color: gridColor } },
      y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor }, beginAtZero: true },
    },
  };

  // Destroy old instances if re-opening a player
  if (_charts.wl) { _charts.wl.destroy(); _charts.wl = null; }
  if (_charts.pts) { _charts.pts.destroy(); _charts.pts = null; }

  const wlCanvas = document.getElementById('chart-wl');
  if (wlCanvas) {
    _charts.wl = new Chart(wlCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Wins', data: winsData, borderColor: '#2ecc71', backgroundColor: 'rgba(46,204,113,0.12)', tension: 0.35, pointRadius: 3, pointHoverRadius: 5, fill: true },
          { label: 'Losses', data: lossesData, borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.10)', tension: 0.35, pointRadius: 3, pointHoverRadius: 5, fill: true },
        ],
      },
      options: sharedOptions,
    });
  }

  const ptsCanvas = document.getElementById('chart-pts');
  if (ptsCanvas) {
    _charts.pts = new Chart(ptsCanvas, {
      type: 'line',
      data: {
        labels: dayLabels,
        datasets: [
          { label: 'Avg Pts', data: ptsData, borderColor: accent, backgroundColor: accent + '22', tension: 0.35, pointRadius: 3, pointHoverRadius: 5, fill: true },
        ],
      },
      options: sharedOptions,
    });
  }
}

loadState();

// Refresh waiting timers once per minute
setInterval(() => {
  if (state.waitingList.length > 0) renderWaitingList();
}, 60000);

// Initialise Lucide icons
if (typeof lucide !== 'undefined') lucide.createIcons();
