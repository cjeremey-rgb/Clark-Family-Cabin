const socket = io();
const $ = s => document.querySelector(s);

const ASSETS = {
  berry1:'berry1.png',berry2:'berry2.png',berry3:'berry3.png',berry4:'berry4.png',berry5:'berry5.png',
  berry6:'berry6.png',berry7:'berry7.png',berry8:'berry8.png',berry9:'berry9.png',berry10:'berry10.png',
  giant:'giant.png',mother:'mother.png',perfect:'perfect.png',unripe:'unripe.png',leaf:'leaf.png',twig:'twig.png',bug:'bug.png',
  bugspray:'bugspray.png',organizer:'organizer.png',evie:'evie.png',spill:'spill.png',rain:'rain.png'
};
const AVATARS = ['🙂','🧢','👩','🧔','👱','👵'];
let roomState = null;
let playerKey = localStorage.getItem('cfcPlayerKey') || crypto.randomUUID();
let playerName = localStorage.getItem('cfcPlayerName') || '';
let currentRoomCode = '';
let openModalKind = null;
let lastInspectionHand = null;
let selectedMaxPlayers = 3;

localStorage.setItem('cfcPlayerKey', playerKey);
$('#nameInput').value = playerName; if($('#joinNameInput')) $('#joinNameInput').value = playerName;
const queryRoom = new URLSearchParams(location.search).get('room');
if (queryRoom) $('#roomCodeInput').value = queryRoom.toUpperCase().slice(0,4);

function cardImage(c){ return c ? ASSETS[c.id] : ''; }
function showScreen(name){
  $('#lobbyScreen')?.classList.toggle('hidden', name !== 'lobby');
  $('#gameScreen')?.classList.toggle('hidden', name !== 'game');
}
function saveName(source='#nameInput'){
  playerName = $(source).value.trim().replace(/\s+/g,' ').slice(0,18);
  localStorage.setItem('cfcPlayerName', playerName);
  return playerName;
}
function showEntryError(msg=''){ $('#entryError').textContent = msg; }
function ackHandler(result){
  if (!result?.ok) return showEntryError(result?.message || 'Unable to join room.');
  currentRoomCode = result.code;
  playerKey = result.playerKey || playerKey;
  localStorage.setItem('cfcPlayerKey', playerKey);
  history.replaceState(null,'',`?room=${currentRoomCode}`);
  showEntryError('');
}



document.querySelectorAll('.player-count button').forEach(btn=>btn.addEventListener('click',()=>{
  selectedMaxPlayers=Number(btn.dataset.n)||3;
  document.querySelectorAll('.player-count button').forEach(b=>b.classList.toggle('selected',b===btn));
}));
$('#lobbyHomeBtn').onclick = () => { if(currentRoomCode) socket.emit('leaveRoom'); location.href='index.html'; };
$('#createBtn').onclick = () => {
  const name = saveName('#nameInput'); if(!name) return showEntryError('Enter your name first.');
  socket.emit('createRoom',{name,playerKey,maxPlayers:selectedMaxPlayers},ackHandler);
};
$('#joinBtn').onclick = () => {
  const name = saveName('#joinNameInput'); const code = $('#roomCodeInput').value.trim().toUpperCase();
  if(!name) return showEntryError('Enter your name first.');
  if(code.length !== 4) return showEntryError('Enter a 4-character room code.');
  socket.emit('joinRoom',{code,name,playerKey},ackHandler);
};
$('#roomCodeInput').addEventListener('input', e => e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4));
$('#shareBtn').onclick = async () => {
  const url = `${location.origin}${location.pathname}?room=${currentRoomCode}`;
  const text = `Join my Clark Family Cabin Huckleberry Bucket room: ${currentRoomCode}\n${url}`;
  try { if(navigator.share) await navigator.share({title:'Huckleberry Bucket',text,url}); else { await navigator.clipboard.writeText(url); toast('Room link copied!'); } } catch(_e){}
};
$('#leaveLobbyBtn').onclick = leaveRoom;
$('#gameHomeBtn').onclick = () => confirmLeave();
$('#rulesBtn').onclick = openRules;
$('#pickBtn').onclick = () => socket.emit('pickAnother');
$('#deckButton').onclick = () => socket.emit('pickAnother');
$('#breakBtn').onclick = () => socket.emit('takeBreak');

function leaveRoom(){ socket.emit('leaveRoom'); currentRoomCode=''; roomState=null; history.replaceState(null,'',location.pathname); $('#roomPanel').classList.add('hidden'); $('#entryPanel').classList.remove('hidden'); showScreen('lobby'); closeModal(); }
function confirmLeave(){ openModal('Leave the Game?','<p>Are you sure you want to leave the current game?</p>',[
  {label:'Stay',action:closeModal},{label:'Leave Game',action:leaveRoom}
]); }

socket.on('connect', () => {
  $('#connectionBadge')?.classList.remove('offline');
  if($('#connectionBadge')) $('#connectionBadge').textContent = '● Connected';
  const code = currentRoomCode || new URLSearchParams(location.search).get('room');
  if(code && playerName) socket.emit('joinRoom',{code:code.toUpperCase(),name:playerName,playerKey},ackHandler);
});
socket.on('disconnect', () => { if($('#connectionBadge')) { $('#connectionBadge').textContent='● Reconnecting'; $('#connectionBadge').classList.add('offline'); } });
socket.on('gameError', ({message}) => toast(message || 'Game error'));
socket.on('sprayAnimation', data => showSprayAnimation(data));
socket.on('roomState', state => {
  roomState = state; currentRoomCode = state.code;
  if(state.phase === 'lobby') renderLobby(state);
  else renderGame(state);
});

function renderLobby(state){
  showScreen('lobby'); $('#entryPanel').classList.add('hidden'); $('#roomPanel').classList.remove('hidden');
  $('#roomCodeText').textContent = state.code;
  const me = state.players.find(p=>p.isYou);
  $('#lobbyPlayers').innerHTML = state.players.map((p,i)=>`<div class="lobby-person"><div class="lobby-avatar">${AVATARS[i%AVATARS.length]}</div><div class="grow"><b>${esc(p.name)}</b><br><small>${p.key===state.hostKey?'Host':'Player'}${p.isYou?' • You':''}</small></div><div>${p.connected?'🟢':'⚪'}</div></div>`).join('');
  const host = me?.key === state.hostKey;
  $('#hostControls').innerHTML = host
    ? `<button id="startRoomGameBtn" class="big-button green" ${state.players.length<2?'disabled':''}>Start Game (${state.players.length} player${state.players.length===1?'':'s'})</button><p style="font-size:12px;text-align:center;margin-bottom:0">2–6 players. Share the room code or link.</p>`
    : `<p style="text-align:center;font-weight:900">Waiting for the host to start…</p>`;
  if(host) $('#startRoomGameBtn').onclick = () => socket.emit('startGame');
}

function renderGame(state){
  showScreen('game');
  $('#handLabel').textContent = `Hand ${state.hand} of ${state.maxHands}`;
  const me = state.players.find(p=>p.isYou);
  const meIndex = state.players.findIndex(p=>p.isYou);
  const opponents = state.players.filter(p=>!p.isYou);
  $('#opponents').innerHTML = opponents.map((p,i)=>playerHTML(p,state,false,AVATARS[(i+1)%AVATARS.length])).join('');
  $('#playerPanel').innerHTML = me ? playerHTML(me,state,true,AVATARS[0]) : '';
  showLatest(state.latestCard,state.players);
  renderLog(state.log);
  updateControls(state,me,meIndex);
  maybeTargetModal(state,me);
  maybePhaseModal(state,me);
}

function playerHTML(p,state,you=false,avatar=AVATARS[0]){
  const isTurn = state.phase==='playing' && state.players[state.turnIndex]?.key === p.key;
  const stateText = !p.connected ? 'DISCONNECTED' : p.busted ? 'BUCKET RUINED' : p.takingBreak ? 'TAKING A BREAK' : isTurn ? 'PICKING' : 'WAITING';
  const imgs = p.cards.length ? p.cards.map(c=>`<div class="bucket-card"><img src="${cardImage(c)}" alt="${esc(c.name)}" title="${esc(c.name)}"></div>`).join('') : '<div class="empty-bucket">Empty metal bucket</div>';
  return `<article class="player-card ${you?'you':''} ${isTurn?'turn':''}"><div class="player-head"><div class="avatar">${avatar}</div><div><div class="player-name">${esc(p.name)}${you?' (You)':''}</div><div class="player-state">${stateText}</div></div><div class="score-badge">${p.score}<br><small>BUCKET</small></div></div><div class="bucket-strip">${imgs}</div><div class="player-state">Trip total: <b>${p.total}</b>${p.multiplier>1?` • Perfect Bush x${p.multiplier}`:''}${p.divisors?` • Spill ÷${Math.pow(2,p.divisors)}`:''}</div></article>`;
}
function showLatest(card,players){
  const img=$('#latestCard'), ph=$('#latestPlaceholder'), who=$('#latestWho');
  if(!card){img.classList.add('hidden');ph.classList.remove('hidden');who.textContent='';return}
  img.src=cardImage(card);img.alt=card.name;img.classList.remove('hidden');ph.classList.add('hidden');
  const p=players.find(p=>p.key===card.drawnByKey);who.textContent=p?`${p.name} drew this`:'';
}
function renderLog(log){ $('#eventLog').innerHTML=[...log].slice(-16).reverse().map(x=>`<div class="event-line">${escTextWithEmoji(x.message)}</div>`).join(''); }
function updateControls(state,me,meIndex){
  const myTurn=state.phase==='playing' && me && state.turnIndex===meIndex && !me.takingBreak && !me.busted && !state.locked;
  $('#pickBtn').disabled=!myTurn; $('#breakBtn').disabled=!myTurn; $('#deckButton').disabled=!myTurn;
  if(state.phase==='playing'){
    if(myTurn) $('#message').textContent='Your turn — Pick Another or Take a Break.';
    else if(state.pendingTarget) $('#message').textContent=`${state.players[state.turnIndex]?.name || 'A player'} is choosing a target…`;
    else $('#message').textContent=`${state.players[state.turnIndex]?.name || 'Another player'} is deciding…`;
  } else $('#message').textContent='Bucket Inspection…';
}

function maybeTargetModal(state,me){
  const pending=state.pendingTarget;
  if(!pending || pending.actorKey!==me?.key){ if(openModalKind==='target') closeModal(); return; }
  if(openModalKind==='target') return;
  const targets=state.players.filter(p=>pending.allowedKeys.includes(p.key));
  openModalKind='target';
  const isEvie=pending.card.type==='evie';
  const content=isEvie
    ? `<div class="special-target-card"><img src="${cardImage(pending.card)}" alt="Evie — The Berry Bandit"></div><p class="target-prompt"><b>Who should Evie visit?</b><br>She will eat that player's highest numbered huckleberry card.</p>`
    : `<p class="target-prompt">Choose whose bucket should be divided by two.</p>`;
  openModal(isEvie?'🐶 Evie — The Berry Bandit':'🪣 Bucket Spill',content,
    targets.map(p=>({label:`${p.name} — ${p.score} points`,action:()=>{closeModal();socket.emit('chooseTarget',{targetKey:p.key})}})));
}
function maybePhaseModal(state,me){
  if(state.phase==='inspection'){
    if(openModalKind==='inspection' && lastInspectionHand===state.hand) return;
    lastInspectionHand=state.hand; openModalKind='inspection';
    const rows=state.inspection?.rows||[];const winner=rows.find(r=>r.key===state.inspection?.handWinnerKey);
    const html=`<p>${esc(state.inspection?.reason||'Hand over.')}</p>${rows.map(r=>`<div class="inspection-row"><span><b>${esc(r.name)}</b>${r.busted?' — Bucket Ruined':''}</span><b>${r.handScore}</b></div>`).join('')}<div class="winner-banner">${winner?`${esc(winner.name)} wins the hand!`:''}</div>`;
    openModal('🪣 Bucket Inspection',html,[{label:state.hand>=state.maxHands?'Final Results':'Next Hand',action:()=>{closeModal();socket.emit('nextHand')}}]);
  } else if(state.phase==='finished'){
    if(openModalKind==='finished') return; openModalKind='finished';
    const ranked=[...state.players].sort((a,b)=>b.total-a.total);
    openModal('🏆 Trip Results',`${ranked.map(p=>`<div class="inspection-row"><span><b>${esc(p.name)}</b></span><b>${p.total}</b></div>`).join('')}<div class="winner-banner">${esc(state.winner?.name||ranked[0]?.name||'')} wins the trip!</div>`,[{label:'Play Again',action:()=>{closeModal();socket.emit('playAgain')}}]);
  } else if(openModalKind==='inspection'||openModalKind==='finished'){closeModal();}
}

function showSprayAnimation({playerName,bugCard,sprayCard,duration=1000}){
  openModalKind='spray';
  openModal('🧴 Bug Spray!',`<p><b>${esc(playerName)}</b> has both cards for one second. Then both are discarded.</p><div class="spray-pair"><img src="${cardImage(bugCard)}" alt="Bug"><img src="${cardImage(sprayCard)}" alt="Bug Spray"></div>`,[]);
  setTimeout(()=>{ if(openModalKind==='spray') closeModal(); },duration);
}
function openRules(){
  openModalKind='rules';
  openModal('How to Play',`<p><b>On your turn:</b> choose <b>Pick Another</b> or <b>Take a Break</b>. A drawn card takes effect immediately, then play moves to the next active player.</p><p><b>Two Bugs</b> ruin your bucket. <b>Bug Spray</b> cancels one Bug. <b>Perfect Bush</b> doubles your entire bucket. <b>Evie</b> eats a chosen player's highest-value huckleberry card. <b>Bucket Spill</b> divides a chosen bucket by two. <b>Rain</b> ends the hand immediately.</p><p>If you are the only picker still active when you draw Evie or Bucket Spill, it must hit your own bucket.</p>`,[{label:'Got It',action:closeModal}]);
}
function openModal(title,content,actions=[]){ $('#modalTitle').innerHTML=title;$('#modalContent').innerHTML=content;const area=$('#modalActions');area.innerHTML='';actions.forEach(a=>{const b=document.createElement('button');b.textContent=a.label;b.onclick=a.action;area.appendChild(b)});$('#modal').classList.remove('hidden'); }
function closeModal(){ $('#modal').classList.add('hidden'); openModalKind=null; }
function toast(message){ openModalKind='toast';openModal('Huckleberry Bucket',`<p>${esc(message)}</p>`,[{label:'OK',action:closeModal}]); }
function esc(s=''){return String(s).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
function escTextWithEmoji(s=''){ return esc(s); }
