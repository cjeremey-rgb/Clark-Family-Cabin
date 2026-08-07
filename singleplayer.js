const $ = s => document.querySelector(s);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const IM = {
  berry:n=>`berry${n}.png`, giant:'giant.png', mother:'mother.png', perfect:'perfect.png',
  unripe:'unripe.png', leaf:'leaf.png', twig:'twig.png', bug:'bug.png', bugspray:'bugspray.png',
  organizer:'organizer.png', evie:'evie.png', spill:'spill.png', rain:'rain.png'
};

const T = [];
const add = (n,c) => { for(let i=0;i<n;i++) T.push({...c}); };
for(let n=1;n<=10;n++){
  const count = n<=2 ? 7 : n<=4 ? 6 : n<=6 ? 5 : n<=8 ? 4 : 3;
  add(count,{id:`berry${n}`,name:`${n} Huckleberr${n===1?'y':'ies'}`,type:'berry',value:n,img:IM.berry(n)});
}
add(2,{id:'giant',name:'Giant Cluster',type:'berry',value:12,img:IM.giant});
add(2,{id:'mother',name:'Mother Lode',type:'berry',value:15,img:IM.mother});
add(2,{id:'perfect',name:'Perfect Bush',type:'perfect',img:IM.perfect});
add(10,{id:'unripe',name:'Unripe Berries',type:'unripe',value:0,img:IM.unripe});
add(7,{id:'leaf',name:'Leaf',type:'leaf',value:-1,img:IM.leaf});
add(6,{id:'twig',name:'Twig',type:'twig',value:-2,img:IM.twig});
add(7,{id:'bug',name:'Bug',type:'bug',img:IM.bug});
add(4,{id:'bugspray',name:'Bug Spray',type:'bugspray',img:IM.bugspray});
add(3,{id:'organizer',name:'Bucket Organizer',type:'organizer',img:IM.organizer});
add(4,{id:'evie',name:'Evie',type:'evie',img:IM.evie});
add(3,{id:'spill',name:'Bucket Spill',type:'spill',img:IM.spill});
add(4,{id:'rain',name:'Rain',type:'rain',img:IM.rain});

function shuffle(a){
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function makeDeck(){ return shuffle(T.map((c,i)=>({...c,uid:`${Date.now()}-${i}-${Math.random()}`}))); }
function fresh(name,index,style){
  return {name,index,style,total:0,cards:[],takingBreak:false,busted:false,multiplier:1,divisors:0,discarded:[]};
}

// The human is player 0, exactly like the first player in a multiplayer room.
// The starting player rotates each hand in the same way as multiplayer.
let P=[fresh('You',0,'player'),fresh('Mara',1,'careful'),fresh('Cole',2,'bold')];
let D=[],turn=0,hand=1,locked=false,latest=null,finished=false;

function score(p){
  if(p.busted) return 0;
  let subtotal=p.cards.reduce((sum,c)=>{
    if(c.type==='berry'||['unripe','leaf','twig'].includes(c.type)) return sum+(c.value||0);
    return sum;
  },0);
  subtotal*=p.multiplier;
  subtotal=Math.floor(subtotal/Math.pow(2,p.divisors));
  return Math.max(0,subtotal);
}
function active(p){ return !p.takingBreak&&!p.busted; }
function activeIndexes(){ return P.map((p,i)=>({p,i})).filter(({p})=>active(p)); }
function removeCardByUid(p,uid){ const i=p.cards.findIndex(c=>c.uid===uid); return i>=0?p.cards.splice(i,1)[0]:null; }

function resetHand(){
  D=makeDeck();
  P.forEach(p=>{p.cards=[];p.takingBreak=false;p.busted=false;p.multiplier=1;p.divisors=0;p.discarded=[];});
  turn=(hand-1)%P.length;
  locked=false;latest=null;finished=false;
  $('#handLabel').textContent=`Hand ${hand} of 5`;
  logClear();log(`🚚 Hand ${hand}: everyone arrives at the berry patch.`);
  render();setMessage();
  if(turn!==0) setTimeout(aiTurn,650);
}

function playerHTML(p,you=false){
  const isTurn=!finished&&p.index===turn&&!locked;
  const state=!p.busted&&!p.takingBreak
    ? (isTurn?'PICKING':'WAITING')
    : p.busted?'BUCKET RUINED':'TAKING A BREAK';
  const cards=p.cards.length
    ? p.cards.map(c=>`<div class="bucket-card"><img src="${c.img}" alt="${c.name}" title="${c.name}"></div>`).join('')
    : '<div class="empty-bucket">Empty metal bucket</div>';
  const avatar=p.index===0?'🙂':p.index===1?'🧢':'👩';
  return `<article class="player-card ${you?'you':''} ${isTurn?'turn':''}"><div class="player-head"><div class="avatar">${avatar}</div><div><div class="player-name">${p.name}${you?' (You)':''}</div><div class="player-state">${state}</div></div><div class="score-badge">${score(p)}<br><small>BUCKET</small></div></div><div class="bucket-strip">${cards}</div><div class="player-state">Trip total: <b>${p.total}</b>${p.multiplier>1?` • Perfect Bush x${p.multiplier}`:''}${p.divisors?` • Spill ÷${Math.pow(2,p.divisors)}`:''}</div></article>`;
}
function render(){
  $('#opponents').innerHTML=P.slice(1).map(p=>playerHTML(p)).join('');
  $('#playerPanel').innerHTML=playerHTML(P[0],true);
  if(latest){
    $('#latestCard').src=latest.card.img;$('#latestCard').alt=latest.card.name;
    $('#latestCard').classList.remove('hidden');$('#latestPlaceholder').classList.add('hidden');
    $('#latestWho').textContent=`${latest.name} drew this`;
  }else{
    $('#latestCard').classList.add('hidden');$('#latestPlaceholder').classList.remove('hidden');$('#latestWho').textContent='';
  }
  const mine=turn===0&&active(P[0])&&!locked&&!finished;
  $('#pickBtn').disabled=!mine;$('#breakBtn').disabled=!mine;$('#deckButton').disabled=!mine;
}
function logClear(){ $('#eventLog').innerHTML=''; }
function log(t){ const d=document.createElement('div');d.className='event-line';d.textContent=t;$('#eventLog').prepend(d); }
function setMessage(){
  if(finished) return;
  $('#message').textContent=turn===0?'Your turn — Pick Another or Take a Break.':`${P[turn].name} is deciding…`;
}
function next(){
  if(activeIndexes().length===0) return endHand('Everyone took a break or ruined their bucket.');
  for(let step=1;step<=P.length;step++){
    const i=(turn+step)%P.length;
    if(active(P[i])){ turn=i;render();setMessage();if(i!==0)setTimeout(aiTurn,650);return; }
  }
  endHand('Everyone took a break or ruined their bucket.');
}

async function drawCard(i){
  if(locked||finished||!active(P[i])) return;
  locked=true;render();
  const c=D.pop()||makeDeck().pop();
  latest={card:c,name:P[i].name};
  log(`${P[i].name} drew ${c.name}.`);render();
  await wait(420);
  await resolveDraw(i,c);
}

async function resolveDraw(i,c){
  const p=P[i];
  if(finished) return;

  if(c.type==='rain'){
    log(`🌧️ ${p.name} drew Rain. The hand ends immediately!`);
    render();
    await wait(650);
    return endHand('Rain ended the hand.');
  }

  if(['berry','unripe','leaf','twig'].includes(c.type)){
    p.cards.push(c);
    return finishTurn(i,380);
  }

  if(c.type==='perfect'){
    p.cards.push(c);p.multiplier*=2;
    log(`🌳 ${p.name} found a Perfect Bush — bucket is now x${p.multiplier}.`);
    return finishTurn(i,520);
  }

  if(c.type==='bug'){
    p.cards.push(c);
    const spray=p.cards.find(x=>x.type==='bugspray');
    if(spray) return sprayPair(i,c,spray);
    if(p.cards.filter(x=>x.type==='bug').length>=2){ p.busted=true;log(`💥 ${p.name}'s bucket is ruined by two Bugs!`); }
    return finishTurn(i,520);
  }

  if(c.type==='bugspray'){
    p.cards.push(c);
    const bug=p.cards.find(x=>x.type==='bug');
    if(bug) return sprayPair(i,bug,c);
    log(`🧴 ${p.name} keeps Bug Spray ready in the bucket.`);
    return finishTurn(i,420);
  }

  if(c.type==='organizer'){
    p.cards.push(c);
    const junk=p.cards.find(x=>x.type==='twig')||p.cards.find(x=>x.type==='leaf');
    if(junk){
      removeCardByUid(p,junk.uid);removeCardByUid(p,c.uid);p.discarded.push(junk,c);
      log(`🧺 ${p.name} uses Bucket Organizer to discard a ${junk.name}.`);
    }else{
      removeCardByUid(p,c.uid);p.discarded.push(c);
      log(`🧺 ${p.name}'s bucket was already tidy.`);
    }
    return finishTurn(i,520);
  }

  if(c.type==='evie'||c.type==='spill'){
    const t=await chooseTarget(i,c);
    resolveTarget(i,t,c);
    return finishTurn(i,520);
  }
}

async function sprayPair(actor,bug,spray){
  const p=P[actor];
  log(`${p.name} has a Bug and Bug Spray — both stay visible for one second.`);
  render();
  openModal('🧴 Bug Spray!',`<p><b>${p.name}</b> has both cards for one second. Then both are discarded.</p><div class="spray-pair"><img src="${bug.img}" alt="Bug"><img src="${spray.img}" alt="Bug Spray"></div>`,[]);
  await wait(1000);closeModal();
  const b=removeCardByUid(p,bug.uid),s=removeCardByUid(p,spray.uid);
  if(b)p.discarded.push(b);if(s)p.discarded.push(s);
  log(`🧴 ${p.name} sprays the Bug. Both cards are discarded.`);
  finishTurn(actor,250);
}
function finishTurn(actor,delay){
  locked=false;render();
  if(finished) return;
  setTimeout(()=>{ if(!finished) next(); },delay);
}
function targetOptions(actor){
  const activeList=activeIndexes();
  if(activeList.length===1&&activeList[0].i===actor) return [actor];
  return P.map((_p,i)=>i).filter(i=>i!==actor);
}
async function chooseTarget(actor,card){
  const list=targetOptions(actor);
  if(list.length===1) return list[0];
  if(actor!==0) return [...list].sort((a,b)=>score(P[b])-score(P[a]))[0];
  return new Promise(resolve=>{
    const isEvie=card.type==='evie';
    const content=isEvie
      ? `<div class="special-target-card"><img src="${card.img}" alt="Evie — The Berry Bandit"></div><p class="target-prompt"><b>Who should Evie visit?</b><br>She will eat that player's highest numbered huckleberry card.</p>`
      : '<p class="target-prompt">Choose whose bucket should be divided by two.</p>';
    openModal(isEvie?'🐶 Evie — The Berry Bandit':'🪣 Bucket Spill',content,list.map(t=>({label:`${P[t].name} — ${score(P[t])} points`,action:()=>{closeModal();resolve(t);}})));
  });
}
function resolveTarget(actorIndex,targetIndex,card){
  const actor=P[actorIndex],target=P[targetIndex];
  if(card.type==='evie'){
    const berries=target.cards.filter(x=>x.type==='berry');
    if(berries.length){
      const high=berries.reduce((a,b)=>a.value>=b.value?a:b);
      const removed=removeCardByUid(target,high.uid);if(removed)target.discarded.push(removed);
      actor.discarded.push(card);
      log(`🐶 ${actor.name} sends Evie to ${target.name}. She eats the ${high.value}-point huckleberry card.`);
    }else{
      actor.discarded.push(card);
      log(`🐶 Evie visits ${target.name}, but there are no ripe huckleberries to eat.`);
    }
    latest=null;
  }else{
    target.divisors+=1;actor.discarded.push(card);
    log(`🪣 ${actor.name} spills ${target.name}'s bucket — its value is divided by 2.`);
  }
}

function aiBreak(p){
  const s=score(p),bugs=p.cards.filter(c=>c.type==='bug').length;
  if(bugs===1&&s>=10) return Math.random()<.82;
  if(p.style==='careful'&&s>=17) return Math.random()<.72;
  if(p.style==='bold'&&s>=28) return Math.random()<.45;
  return false;
}
async function aiTurn(){
  if(finished||turn===0) return;
  const p=P[turn];
  if(aiBreak(p)){
    p.takingBreak=true;log(`☕ ${p.name} takes a break with ${score(p)} points.`);render();
    setTimeout(next,350);
  }else drawCard(turn);
}

function endHand(reason){
  if(finished) return;
  finished=true;locked=true;
  const rows=P.map(p=>({p,s:score(p)})).sort((a,b)=>b.s-a.s);
  P.forEach(p=>p.total+=score(p));
  openModal('🪣 Bucket Inspection',`<p>${reason}</p>${rows.map(x=>`<div class="inspection-row"><span><b>${x.p.name}</b>${x.p.busted?' — Bucket Ruined':''}</span><b>${x.s}</b></div>`).join('')}<div class="winner-banner">${rows[0].p.name} wins the hand!</div>`,[
    {label:hand>=5?'Final Results':'Next Hand',action:()=>{closeModal();if(hand>=5)finalResults();else{hand++;resetHand();}}}
  ]);
  render();
}
function finalResults(){
  const rows=[...P].sort((a,b)=>b.total-a.total);
  openModal('🏆 Trip Results',rows.map(p=>`<div class="inspection-row"><span><b>${p.name}</b></span><b>${p.total}</b></div>`).join('')+`<div class="winner-banner">${rows[0].name} wins the trip!</div>`,[{label:'Play Again',action:()=>location.reload()}]);
}
function openRules(){
  openModal('How to Play',`<p><b>On your turn:</b> choose <b>Pick Another</b> or <b>Take a Break</b>. A drawn card takes effect immediately, then play moves to the next active player.</p><p><b>Two Bugs</b> ruin your bucket. <b>Bug Spray</b> cancels one Bug. <b>Perfect Bush</b> doubles your entire bucket. <b>Evie</b> eats a chosen player's highest-value huckleberry card. <b>Bucket Spill</b> divides a chosen bucket by two. <b>Rain</b> ends the hand immediately.</p><p>If you are the only picker still active when you draw Evie or Bucket Spill, it must hit your own bucket.</p>`,[{label:'Got It',action:closeModal}]);
}
function openModal(title,content,actions=[]){
  $('#modalTitle').innerHTML=title;$('#modalContent').innerHTML=content;
  const area=$('#modalActions');area.innerHTML='';
  actions.forEach(a=>{const b=document.createElement('button');b.textContent=a.label;b.onclick=a.action;area.appendChild(b);});
  $('#modal').classList.remove('hidden');
}
function closeModal(){ $('#modal').classList.add('hidden'); }

$('#pickBtn').onclick=()=>drawCard(0);
$('#deckButton').onclick=()=>drawCard(0);
$('#breakBtn').onclick=()=>{
  if(turn!==0||locked||finished)return;
  P[0].takingBreak=true;log(`☕ You take a break with ${score(P[0])} points.`);render();
  if(activeIndexes().length===0)endHand('Everyone took a break or ruined their bucket.');else setTimeout(next,350);
};
$('#gameHomeBtn').onclick=()=>openModal('Leave the Game?','<p>Are you sure you want to leave the current game?</p>',[{label:'Stay',action:closeModal},{label:'Leave Game',action:()=>location.href='index.html'}]);
$('#rulesBtn').onclick=openRules;
resetHand();
