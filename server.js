const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
  pingTimeout: 25000,
  pingInterval: 10000
});

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const rooms = new Map();

const CLIENT_FILES = new Set([
  'index.html','singleplayer.html','multiplayer.html','styles.css','singleplayer.js','multiplayer.js','startup.png','mode-bucket.png','card-back.png',
  'berry1.png','berry2.png','berry3.png','berry4.png','berry5.png','berry6.png','berry7.png','berry8.png','berry9.png','berry10.png',
  'giant.png','mother.png','perfect.png','unripe.png','leaf.png','twig.png','bug.png','bugspray.png','organizer.png','evie.png','spill.png','rain.png',
  'woodgrain-hd.jpg','parchment-hd.jpg','panel-wide.png','panel-small.png','panel-tall.png','player-frame-clean.png','sign-clean.png','button-green-clean.png','button-wood-clean.png'
]);

app.get('/healthz', (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get('/', (_req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.get('/singleplayer', (_req,res)=>res.sendFile(path.join(ROOT,'singleplayer.html')));
app.get('/multiplayer', (_req,res)=>res.sendFile(path.join(ROOT,'multiplayer.html')));
app.get('/:file', (req, res) => {
  if (!CLIENT_FILES.has(req.params.file)) return res.status(404).send('Not found');
  res.sendFile(path.join(ROOT, req.params.file));
});

const CARD_TEMPLATES = [];
function addCopies(count, card) {
  for (let i = 0; i < count; i++) CARD_TEMPLATES.push({ ...card });
}
for (let n = 1; n <= 10; n++) {
  const count = n <= 2 ? 7 : n <= 4 ? 6 : n <= 6 ? 5 : n <= 8 ? 4 : 3;
  addCopies(count, { id: `berry${n}`, name: `${n} Huckleberr${n === 1 ? 'y' : 'ies'}`, type: 'berry', value: n });
}
addCopies(2, { id: 'giant', name: 'Giant Cluster', type: 'berry', value: 12 });
addCopies(2, { id: 'mother', name: 'Mother Lode', type: 'berry', value: 15 });
addCopies(2, { id: 'perfect', name: 'Perfect Bush', type: 'perfect' });
addCopies(10, { id: 'unripe', name: 'Unripe Berries', type: 'unripe', value: 0 });
addCopies(7, { id: 'leaf', name: 'Leaf', type: 'leaf', value: -1 });
addCopies(6, { id: 'twig', name: 'Twig', type: 'twig', value: -2 });
addCopies(7, { id: 'bug', name: 'Bug', type: 'bug' });
addCopies(4, { id: 'bugspray', name: 'Bug Spray', type: 'bugspray' });
addCopies(3, { id: 'organizer', name: 'Bucket Organizer', type: 'organizer' });
addCopies(4, { id: 'evie', name: 'Evie', type: 'evie' });
addCopies(3, { id: 'spill', name: 'Bucket Spill', type: 'spill' });
addCopies(4, { id: 'rain', name: 'Rain', type: 'rain' });

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
function makeDeck() {
  return shuffle(CARD_TEMPLATES.map(c => ({ ...c, uid: crypto.randomUUID() })));
}
function roomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let tries = 0; tries < 50; tries++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    if (!rooms.has(code)) return code;
  }
  return crypto.randomBytes(3).toString('hex').slice(0,4).toUpperCase();
}
function cleanName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 18) || 'Picker';
}
function freshPlayer({ key, name, socketId }) {
  return {
    key, name: cleanName(name), socketId, connected: true,
    total: 0, cards: [], takingBreak: false, busted: false,
    multiplier: 1, divisors: 0, discarded: []
  };
}
function resetPlayerForHand(p) {
  p.cards = [];
  p.takingBreak = false;
  p.busted = false;
  p.multiplier = 1;
  p.divisors = 0;
  p.discarded = [];
}
function score(p) {
  if (p.busted) return 0;
  let subtotal = p.cards.reduce((sum, c) => {
    if (c.type === 'berry' || ['unripe','leaf','twig'].includes(c.type)) return sum + (c.value || 0);
    return sum;
  }, 0);
  subtotal *= p.multiplier;
  subtotal = Math.floor(subtotal / Math.pow(2, p.divisors));
  return Math.max(0, subtotal);
}
function bugCards(p) { return p.cards.filter(c => c.type === 'bug'); }
function sprayCards(p) { return p.cards.filter(c => c.type === 'bugspray'); }
function activeIndexes(room) {
  return room.players.map((p, i) => ({ p, i })).filter(({ p }) => !p.takingBreak && !p.busted);
}
function playerBySocket(room, socket) {
  return room.players.find(p => p.socketId === socket.id);
}
function playerIndexBySocket(room, socket) {
  return room.players.findIndex(p => p.socketId === socket.id);
}
function log(room, message) {
  room.log.push({ id: crypto.randomUUID(), message, ts: Date.now() });
  if (room.log.length > 60) room.log.shift();
}
function sanitizeRoom(room, viewerKey) {
  return {
    code: room.code,
    phase: room.phase,
    hostKey: room.hostKey,
    hand: room.hand,
    maxHands: room.maxHands,
    maxPlayers: room.maxPlayers || 6,
    turnIndex: room.turnIndex,
    latestCard: room.latestCard,
    pendingTarget: room.pendingTarget ? {
      actorKey: room.players[room.pendingTarget.actorIndex]?.key,
      card: room.pendingTarget.card,
      allowedKeys: room.pendingTarget.allowedIndexes.map(i => room.players[i]?.key).filter(Boolean)
    } : null,
    players: room.players.map((p, index) => ({
      key: p.key, name: p.name, connected: p.connected, index,
      total: p.total, cards: p.cards, takingBreak: p.takingBreak,
      busted: p.busted, multiplier: p.multiplier, divisors: p.divisors,
      score: score(p), isYou: p.key === viewerKey
    })),
    log: room.log,
    inspection: room.inspection,
    winner: room.winner,
    locked: room.locked
  };
}
function emitRoom(room) {
  room.players.forEach(p => {
    if (!p.socketId) return;
    const s = io.sockets.sockets.get(p.socketId);
    if (s) s.emit('roomState', sanitizeRoom(room, p.key));
  });
}
function emitError(socket, message) { socket.emit('gameError', { message }); }
function setSocketRoom(socket, room, player) {
  socket.data.roomCode = room.code;
  socket.data.playerKey = player.key;
  socket.join(room.code);
}
function nextActiveIndex(room, fromIndex) {
  if (!room.players.length) return -1;
  for (let step = 1; step <= room.players.length; step++) {
    const i = (fromIndex + step) % room.players.length;
    const p = room.players[i];
    if (!p.takingBreak && !p.busted) return i;
  }
  return -1;
}
function beginHand(room) {
  room.phase = 'playing';
  room.deck = makeDeck();
  room.latestCard = null;
  room.pendingTarget = null;
  room.locked = false;
  room.inspection = null;
  room.winner = null;
  room.players.forEach(resetPlayerForHand);
  const starter = (room.hand - 1) % room.players.length;
  room.turnIndex = starter;
  log(room, `🚚 Hand ${room.hand}: everyone arrives at the berry patch.`);
  emitRoom(room);
}
function endHand(room, reason = 'Everyone is done picking.') {
  if (room.phase !== 'playing') return;
  room.phase = 'inspection';
  room.locked = true;
  room.pendingTarget = null;
  const rows = room.players.map((p, index) => {
    const handScore = score(p);
    p.total += handScore;
    return { key: p.key, name: p.name, index, handScore, total: p.total, busted: p.busted };
  }).sort((a,b) => b.handScore - a.handScore);
  room.inspection = { reason, rows, handWinnerKey: rows[0]?.key || null };
  log(room, `🪣 Bucket Inspection — ${rows[0]?.name || 'Nobody'} wins the hand with ${rows[0]?.handScore || 0}.`);
  emitRoom(room);
}
function finishGame(room) {
  room.phase = 'finished';
  const ranked = room.players.map((p,index)=>({key:p.key,name:p.name,index,total:p.total})).sort((a,b)=>b.total-a.total);
  room.winner = ranked[0] || null;
  log(room, `🏆 ${room.winner?.name || 'Nobody'} wins the trip!`);
  emitRoom(room);
}
function maybeEndIfNoActive(room) {
  if (room.phase !== 'playing') return true;
  if (activeIndexes(room).length === 0) {
    endHand(room, 'Everyone took a break or ruined their bucket.');
    return true;
  }
  return false;
}
function advanceTurn(room, actorIndex) {
  if (room.phase !== 'playing') return;
  if (maybeEndIfNoActive(room)) return;
  const next = nextActiveIndex(room, actorIndex);
  if (next < 0) return endHand(room);
  room.turnIndex = next;
  room.locked = false;
  emitRoom(room);
}
function targetOptions(room, actorIndex) {
  const active = activeIndexes(room);
  if (active.length === 1 && active[0].i === actorIndex) return [actorIndex];
  return room.players.map((_p, i) => i).filter(i => i !== actorIndex);
}
function removeCardByUid(p, uid) {
  const idx = p.cards.findIndex(c => c.uid === uid);
  if (idx >= 0) return p.cards.splice(idx, 1)[0];
  return null;
}
function runSprayAnimation(room, actorIndex, bugCard, sprayCard, after) {
  const p = room.players[actorIndex];
  room.locked = true;
  emitRoom(room);
  io.to(room.code).emit('sprayAnimation', {
    playerKey: p.key, playerName: p.name, bugCard, sprayCard, duration: 1000
  });
  setTimeout(() => {
    removeCardByUid(p, bugCard.uid);
    removeCardByUid(p, sprayCard.uid);
    p.discarded.push(bugCard, sprayCard);
    log(room, `🧴 ${p.name} sprays the Bug. Both cards are discarded.`);
    after();
  }, 1000);
}
function resolveDraw(room, actorIndex, card) {
  const p = room.players[actorIndex];
  if (room.phase !== 'playing') return;
  if (card.type === 'rain') {
    log(room, `🌧️ ${p.name} drew Rain. The hand ends immediately!`);
    room.latestCard = card;
    emitRoom(room);
    return setTimeout(() => endHand(room, 'Rain ended the hand.'), 650);
  }

  if (['berry','unripe','leaf','twig'].includes(card.type)) {
    p.cards.push(card);
    room.locked = false;
    emitRoom(room);
    return setTimeout(() => advanceTurn(room, actorIndex), 380);
  }

  if (card.type === 'perfect') {
    p.cards.push(card);
    p.multiplier *= 2;
    log(room, `🌳 ${p.name} found a Perfect Bush — bucket is now x${p.multiplier}.`);
    room.locked = false;
    emitRoom(room);
    return setTimeout(() => advanceTurn(room, actorIndex), 520);
  }

  if (card.type === 'bug') {
    p.cards.push(card);
    const spray = sprayCards(p)[0];
    if (spray) {
      return runSprayAnimation(room, actorIndex, card, spray, () => {
        room.locked = false;
        emitRoom(room);
        setTimeout(() => advanceTurn(room, actorIndex), 250);
      });
    }
    if (bugCards(p).length >= 2) {
      p.busted = true;
      log(room, `💥 ${p.name}'s bucket is ruined by two Bugs!`);
    }
    room.locked = false;
    emitRoom(room);
    return setTimeout(() => advanceTurn(room, actorIndex), 520);
  }

  if (card.type === 'bugspray') {
    p.cards.push(card);
    const bug = bugCards(p)[0];
    if (bug) {
      return runSprayAnimation(room, actorIndex, bug, card, () => {
        room.locked = false;
        emitRoom(room);
        setTimeout(() => advanceTurn(room, actorIndex), 250);
      });
    }
    log(room, `🧴 ${p.name} keeps Bug Spray ready in the bucket.`);
    room.locked = false;
    emitRoom(room);
    return setTimeout(() => advanceTurn(room, actorIndex), 420);
  }

  if (card.type === 'organizer') {
    p.cards.push(card);
    const junk = p.cards.find(c => c.type === 'twig') || p.cards.find(c => c.type === 'leaf');
    if (junk) {
      removeCardByUid(p, junk.uid);
      removeCardByUid(p, card.uid);
      p.discarded.push(junk, card);
      log(room, `🧺 ${p.name} uses Bucket Organizer to discard a ${junk.name}.`);
    } else {
      removeCardByUid(p, card.uid);
      p.discarded.push(card);
      log(room, `🧺 ${p.name}'s bucket was already tidy.`);
    }
    room.locked = false;
    emitRoom(room);
    return setTimeout(() => advanceTurn(room, actorIndex), 520);
  }

  if (card.type === 'evie' || card.type === 'spill') {
    const allowedIndexes = targetOptions(room, actorIndex);
    room.pendingTarget = { actorIndex, card, allowedIndexes };
    room.locked = true;
    log(room, card.type === 'evie' ? `🐶 ${p.name} drew Evie and must choose a bucket.` : `🪣 ${p.name} drew Bucket Spill and must choose a bucket.`);
    emitRoom(room);
    if (allowedIndexes.length === 1) {
      return setTimeout(() => resolveTarget(room, actorIndex, allowedIndexes[0]), 500);
    }
    return;
  }
}
function resolveTarget(room, actorIndex, targetIndex) {
  const pending = room.pendingTarget;
  if (!pending || pending.actorIndex !== actorIndex || !pending.allowedIndexes.includes(targetIndex)) return false;
  const actor = room.players[actorIndex];
  const target = room.players[targetIndex];
  const card = pending.card;
  room.pendingTarget = null;

  // Targeted action cards are not bucket cards. Remove the drawn action card
  // from the actor as soon as its target is resolved.
  removeCardByUid(actor, card.uid);

  if (card.type === 'evie') {
    const berryCards = target.cards.filter(c => c.type === 'berry');
    if (berryCards.length) {
      const high = berryCards.reduce((a,b)=>a.value >= b.value ? a : b);
      removeCardByUid(target, high.uid);
      target.discarded.push(high);
      actor.discarded.push(card);
      log(room, `🐶 ${actor.name} sends Evie to ${target.name}. She eats the ${high.value}-point huckleberry card.`);
    } else {
      actor.discarded.push(card);
      log(room, `🐶 Evie visits ${target.name}, but there are no ripe huckleberries to eat.`);
    }
    // Evie is an instant action card: after the target is chosen, neither Evie nor
    // the eaten berry remains visible in a bucket or as the latest drawn card.
    room.latestCard = null;
  } else {
    target.divisors += 1;
    actor.discarded.push(card);
    log(room, `🪣 ${actor.name} spills ${target.name}'s bucket — its value is divided by 2.`);
  }
  room.locked = false;
  emitRoom(room);
  setTimeout(() => advanceTurn(room, actorIndex), 520);
  return true;
}

io.on('connection', socket => {
  socket.on('createRoom', ({ name, playerKey, maxPlayers } = {}, ack = () => {}) => {
    const key = String(playerKey || crypto.randomUUID()).slice(0,80);
    const code = roomCode();
    const player = freshPlayer({ key, name, socketId: socket.id });
    const room = {
      code, hostKey: key, phase: 'lobby', hand: 1, maxHands: 5, maxPlayers: Math.min(6,Math.max(2,Number(maxPlayers)||3)),
      turnIndex: 0, players: [player], deck: [], latestCard: null,
      pendingTarget: null, locked: false, inspection: null, winner: null,
      log: []
    };
    rooms.set(code, room);
    setSocketRoom(socket, room, player);
    log(room, `🏡 ${player.name} created room ${code}.`);
    ack({ ok: true, code, playerKey: key });
    emitRoom(room);
  });

  socket.on('joinRoom', ({ code, name, playerKey } = {}, ack = () => {}) => {
    code = String(code || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return ack({ ok:false, message:'Room not found.' });
    const key = String(playerKey || crypto.randomUUID()).slice(0,80);
    let player = room.players.find(p => p.key === key);
    if (player) {
      player.socketId = socket.id; player.connected = true;
      if (name) player.name = cleanName(name);
      setSocketRoom(socket, room, player);
      ack({ ok:true, code, playerKey:key, rejoined:true });
      log(room, `🔄 ${player.name} rejoined the room.`);
      return emitRoom(room);
    }
    if (room.phase !== 'lobby') return ack({ ok:false, message:'That game has already started.' });
    if (room.players.length >= (room.maxPlayers||6)) return ack({ ok:false, message:`That room is full (${room.maxPlayers||6} players max).` });
    player = freshPlayer({ key, name, socketId: socket.id });
    room.players.push(player);
    setSocketRoom(socket, room, player);
    log(room, `🫐 ${player.name} joined the picking crew.`);
    ack({ ok:true, code, playerKey:key });
    emitRoom(room);
  });

  socket.on('startGame', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const p = playerBySocket(room, socket);
    if (!p || p.key !== room.hostKey) return emitError(socket, 'Only the host can start the game.');
    if (room.phase !== 'lobby') return;
    if (room.players.length < 2) return emitError(socket, 'At least 2 players are needed.');
    room.hand = 1;
    room.players.forEach(p=>p.total=0);
    beginHand(room);
  });

  socket.on('pickAnother', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || room.locked) return;
    const actorIndex = playerIndexBySocket(room, socket);
    if (actorIndex !== room.turnIndex) return emitError(socket, 'It is not your turn.');
    const p = room.players[actorIndex];
    if (p.takingBreak || p.busted) return;
    room.locked = true;
    const card = room.deck.pop() || makeDeck().pop();
    room.latestCard = { ...card, drawnByKey: p.key };
    log(room, `${p.name} drew ${card.name}.`);
    emitRoom(room);
    setTimeout(() => resolveDraw(room, actorIndex, card), 420);
  });

  socket.on('takeBreak', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || room.locked) return;
    const actorIndex = playerIndexBySocket(room, socket);
    if (actorIndex !== room.turnIndex) return emitError(socket, 'It is not your turn.');
    const p = room.players[actorIndex];
    p.takingBreak = true;
    log(room, `☕ ${p.name} takes a break with ${score(p)} points.`);
    emitRoom(room);
    if (maybeEndIfNoActive(room)) return;
    setTimeout(() => advanceTurn(room, actorIndex), 350);
  });

  socket.on('chooseTarget', ({ targetKey } = {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || !room.pendingTarget) return;
    const actorIndex = playerIndexBySocket(room, socket);
    if (actorIndex !== room.pendingTarget.actorIndex) return emitError(socket, 'You are not choosing this target.');
    const targetIndex = room.players.findIndex(p => p.key === targetKey);
    if (!resolveTarget(room, actorIndex, targetIndex)) emitError(socket, 'That target is not available.');
  });

  socket.on('nextHand', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'inspection') return;
    const p = playerBySocket(room, socket);
    if (!p) return;
    if (room.hand >= room.maxHands) return finishGame(room);
    room.hand += 1;
    beginHand(room);
  });

  socket.on('playAgain', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'finished') return;
    const p = playerBySocket(room, socket);
    if (!p) return;
    room.hand = 1;
    room.players.forEach(p => p.total = 0);
    beginHand(room);
  });

  socket.on('leaveRoom', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const idx = playerIndexBySocket(room, socket);
    if (idx < 0) return;
    const [left] = room.players.splice(idx,1);
    socket.leave(room.code);
    socket.data.roomCode = null;
    if (!room.players.length) { rooms.delete(room.code); return; }
    if (left.key === room.hostKey) room.hostKey = room.players[0].key;
    if (room.phase === 'lobby') {
      log(room, `👋 ${left.name} left the room.`);
    } else {
      log(room, `👋 ${left.name} left the game.`);
      if (idx < room.turnIndex) room.turnIndex -= 1;
      if (room.turnIndex >= room.players.length) room.turnIndex = 0;
      if (room.phase === 'playing' && room.players.length < 2) {
        room.phase = 'lobby'; room.hand = 1; room.players.forEach(p=>{p.total=0;resetPlayerForHand(p)});
        log(room, 'Waiting for another player to join.');
      }
    }
    emitRoom(room);
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const p = room.players.find(p => p.key === socket.data.playerKey);
    if (!p) return;
    p.connected = false; p.socketId = null;
    log(room, `📡 ${p.name} disconnected.`);
    emitRoom(room);
    if (room.phase === 'playing' && room.players[room.turnIndex]?.key === p.key) {
      p.takingBreak = true;
      setTimeout(() => advanceTurn(room, room.turnIndex), 500);
    }
    setTimeout(() => {
      const current = rooms.get(room.code);
      if (!current) return;
      const still = current.players.find(x => x.key === p.key);
      if (still && !still.connected && current.phase === 'lobby') {
        const i = current.players.indexOf(still);
        current.players.splice(i,1);
        if (!current.players.length) rooms.delete(current.code);
        else {
          if (current.hostKey === still.key) current.hostKey = current.players[0].key;
          emitRoom(current);
        }
      }
    }, 10 * 60 * 1000);
  });
});

server.listen(PORT, () => console.log(`Clark Family Cabin multiplayer running on port ${PORT}`));
