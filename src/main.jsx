import React,{useEffect,useMemo,useState}from'react';
import{createRoot}from'react-dom/client';
import{configured,supabase}from'./supabase';
import{CHARACTERS,SPACES,buildDeck,shuffle,barSetup}from'./gameData';
import{addCoins,drawCards,nextSpace,resolveSpaceEffect,returnBars,spaceEligibility,spaceMode,sweepNewest,takeBars}from'./v05Mechanics';
import'./styles.css';

const clone=x=>JSON.parse(JSON.stringify(x));
const roomCode=()=>Math.random().toString(36).slice(2,7).toUpperCase();
const emptyPlayed=()=>({Sweet:[],Rowdy:[],Mystery:[]});
const character=id=>CHARACTERS.find(c=>c.id===id);
const countByName=cards=>cards.reduce((a,c)=>(a[c.name]=(a[c.name]||0)+1,a),{});
const randomItem=a=>a[Math.floor(Math.random()*a.length)];
const eventId=()=>`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
const responseFor=(player,id)=>player?.private_state?.eventResponses?.[id];

function App(){
 const[session,setSession]=useState(null),[name,setName]=useState(localStorage.getItem('gt_name')||''),[code,setCode]=useState(''),[room,setRoom]=useState(null),[players,setPlayers]=useState([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 const[dialog,setDialog]=useState(null),[inspect,setInspect]=useState(null),[leftOpen,setLeftOpen]=useState(true),[logOpen,setLogOpen]=useState(false);
 useEffect(()=>{if(!configured)return;supabase.auth.getSession().then(({data})=>setSession(data.session));const{data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(!room?.code||!configured)return;loadRoom(room.code);const ch=supabase.channel(`room-${room.code}`).on('postgres_changes',{event:'*',schema:'public',table:'rooms',filter:`code=eq.${room.code}`},()=>loadRoom(room.code)).on('postgres_changes',{event:'*',schema:'public',table:'players',filter:`room_code=eq.${room.code}`},()=>loadRoom(room.code)).subscribe();return()=>supabase.removeChannel(ch)},[room?.code]);
 const me=players.find(p=>p.user_id===session?.user?.id),isHost=room?.host_id===session?.user?.id,myTurn=room?.state?.phase==='turn'&&me?.seat===room.state.turnSeat;
 const activeEffect=room?.state?.effect?.status==='collecting'?room.state.effect:null;
 async function auth(){if(session)return session;const{data,error}=await supabase.auth.signInAnonymously();if(error)throw error;return data.session}
 async function loadRoom(c){const[{data:r},{data:p}]=await Promise.all([supabase.from('rooms').select('*').eq('code',c).single(),supabase.from('players').select('*').eq('room_code',c).order('seat')]);if(r){setRoom(r);setPlayers(p||[])}}
 async function patchPlayer(id,patch){const{error}=await supabase.from('players').update(patch).eq('id',id);if(error)throw error}
 async function commitState(next,patches=[]){try{setBusy(true);await Promise.all(patches.map(({id,patch})=>patchPlayer(id,patch)));const{error}=await supabase.from('rooms').update({state:next}).eq('code',room.code);if(error)throw error}catch(e){setMsg(e.message)}finally{setBusy(false)}}
 function actionFinished(st,type){
  st.actions=Math.max(0,st.actions-1);
  st.turnFlags={...(st.turnFlags||{}),normalActions:[...(st.turnFlags?.normalActions||[]),type]};
  if(me.character==='mike'&&st.turnFlags.normalActions.length===2&&st.turnFlags.normalActions.every(x=>x==='Rowdy')&&!st.turnFlags.mikeOffered)st.turnFlags.mikeOffered=true;
 }
 function beginEffect(st,type,meta,eligible){
  st.phase='effect';
  st.effect={id:eventId(),type,status:'collecting',actorId:me.id,actorUserId:me.user_id,eligible,meta,createdAt:new Date().toISOString()};
  st.log.push(`${type} is waiting for ${eligible.length} player response${eligible.length===1?'':'s'}.`);
 }
 async function submitEffectResponse(response){
  const effect=room.state.effect;
  if(!effect||effect.status!=='collecting'||!effect.eligible.includes(me.user_id)||responseFor(me,effect.id)||busy)return;
  const privateState=clone(me.private_state);
  privateState.eventResponses={...(privateState.eventResponses||{}),[effect.id]:response};
  try{
   setBusy(true);
   const{data,error}=await supabase.from('players').update({private_state:privateState}).eq('id',me.id).eq('private_state',me.private_state).select('id').maybeSingle();
   if(error)throw error;
   if(!data)await loadRoom(room.code)
  }catch(e){setMsg(e.message)}finally{setBusy(false)}
 }
 async function resolvePendingEffect(effect){
  if(!effect||effect.status!=='collecting'||busy)return;
  const ready=effect.eligible.every(uid=>responseFor(players.find(p=>p.user_id===uid),effect.id));
  if(!ready)return;
  const claimed=clone(room.state);claimed.effect={...effect,status:'resolving',resolver:session.user.id};
  const{data:won,error}=await supabase.from('rooms').update({state:claimed}).eq('code',room.code).contains('state',{effect:{id:effect.id,status:'collecting'}}).select('state').maybeSingle();
  if(error||!won)return;
  const st=clone(won.state),patches=[],actor=players.find(p=>p.id===effect.actorId);
  if(!actor)return;
  const actorPub=clone(actor.public_state),actorPrivate=clone(actor.private_state),actorHand=clone(actorPrivate.hand);
  if(actorPrivate.eventResponses)delete actorPrivate.eventResponses[effect.id];
  const cleanResponses=p=>{const next=clone(p.private_state);if(next.eventResponses)delete next.eventResponses[effect.id];return next};
  let actorChanged=false;
  if(effect.type==='exploding'){
   const target=players.find(p=>p.id===effect.meta.targetId),answer=responseFor(target,effect.id),targetPub=clone(target.public_state),targetPrivate=cleanResponses(target),targetHand=clone(targetPrivate.hand);
   if(answer.choice==='block'){
    const block=targetHand.find(c=>c.id===answer.cardId&&c.name==='Exploding Candy');
    if(block){targetPub.played.Rowdy.push(block);targetPrivate.hand=targetHand.filter(c=>c.id!==block.id);st.log.push(`${target.name} blocked Exploding Candy.`)}
    else returnBars(st,targetPub,target.user_id,2);
   }else returnBars(st,targetPub,target.user_id,2);
   patches.push({id:target.id,patch:{private_state:targetPrivate,public_state:targetPub}})
  }
  if(effect.type==='slugworth'){
   for(const uid of effect.eligible){
    const target=players.find(p=>p.user_id===uid),answer=responseFor(target,effect.id),nextPrivate=cleanResponses(target),hand=clone(nextPrivate.hand),need=effect.meta.required[uid];
    const ids=(answer.discardIds||[]).filter(id=>hand.some(c=>c.id===id));
    if(ids.length!==need)continue;
    st.discard.push(...hand.filter(c=>ids.includes(c.id)));nextPrivate.hand=hand.filter(c=>!ids.includes(c.id));
    if(target.id===actor.id){actorPrivate.hand=nextPrivate.hand;delete actorPrivate.eventResponses?.[effect.id];actorChanged=true}else patches.push({id:target.id,patch:{private_state:nextPrivate}})
   }
  }
  if(effect.type==='gumdrop'){
   for(const target of players){
    const copies=target.private_state.hand.filter(c=>c.name==='Invisible Gumdrop');
    if(!copies.length)continue;
    const answer=responseFor(target,effect.id),amount=copies.length===1?1:Math.max(1,Math.min(copies.length,answer?.amount||1));
    const selected=copies.slice(0,amount),nextPub=target.id===actor.id?actorPub:clone(target.public_state),nextPrivate=target.id===actor.id?actorPrivate:cleanResponses(target);
    selected.forEach(c=>nextPub.played.Rowdy.push(c));nextPrivate.hand=nextPrivate.hand.filter(c=>!selected.some(s=>s.id===c.id));
    const gained=takeBars(st,nextPub,target.user_id,amount);
    if(target.character==='violet'&&gained>=2)drawCards(st,nextPrivate.hand,1);
    if(target.id===actor.id)actorChanged=true;else patches.push({id:target.id,patch:{private_state:nextPrivate,public_state:nextPub}})
   }
  }
  if(effect.type==='juicy'){
   for(const uid of effect.eligible){
    const target=players.find(p=>p.user_id===uid),answer=responseFor(target,effect.id),nextPrivate=cleanResponses(target);
    if(answer.choice==='give'){
     const gift=nextPrivate.hand.find(c=>c.id===answer.cardId);
     if(gift){nextPrivate.hand=nextPrivate.hand.filter(c=>c.id!==gift.id);actorHand.push(gift);const targetPub=clone(target.public_state);addCoins(targetPub,2);patches.push({id:target.id,patch:{private_state:nextPrivate,public_state:targetPub}});continue}
    }
    patches.push({id:target.id,patch:{private_state:nextPrivate}})
   }
   actorPrivate.hand=actorHand;actorChanged=true
  }
  if(actorChanged){
   if(effect.type!=='slugworth')actorPrivate.hand=effect.type==='juicy'?actorHand:actorPrivate.hand;
   patches.push({id:actor.id,patch:{private_state:actorPrivate,public_state:actorPub}})
  }
  st.phase='turn';st.effect={status:'idle',id:null};st.log.push(`${effect.type} finished resolving.`);
  await commitState(st,patches)
 }
 useEffect(()=>{if(activeEffect)resolvePendingEffect(activeEffect)},[activeEffect?.id,players]);
 useEffect(()=>{
  if(!room||!me||room.state.phase!=='turn'||me.seat!==room.state.turnSeat||dialog)return;
  if(room.state.turnFlags?.mikeOffered&&!room.state.turnFlags?.mikeUsed)setDialog({type:'mike'})
 },[room?.state?.phase,room?.state?.turnFlags?.mikeOffered,me?.id]);
 async function createRoom(){try{setBusy(true);setMsg('');const s=await auth(),c=roomCode();localStorage.setItem('gt_name',name);const{error}=await supabase.from('rooms').insert({code:c,host_id:s.user.id,status:'lobby',state:{phase:'lobby',log:[`${name} created the room.`]}});if(error)throw error;await supabase.from('players').insert({room_code:c,user_id:s.user.id,name,seat:0,ready:false,character:null,public_state:{money:0,bars:0,space:8,played:emptyPlayed()},private_state:{hand:[]}});await loadRoom(c)}catch(e){setMsg(e.message)}finally{setBusy(false)}}
 async function joinRoom(){try{setBusy(true);setMsg('');const s=await auth(),c=code.trim().toUpperCase();localStorage.setItem('gt_name',name);const{data:r,error}=await supabase.from('rooms').select('*').eq('code',c).single();if(error||!r)throw new Error('Room not found.');const{data:p}=await supabase.from('players').select('*').eq('room_code',c);if(p.some(x=>x.user_id===s.user.id)){await loadRoom(c);return}if(p.length>=5)throw new Error('Room is full.');await supabase.from('players').insert({room_code:c,user_id:s.user.id,name,seat:p.length,ready:false,character:null,public_state:{money:0,bars:0,space:8,played:emptyPlayed()},private_state:{hand:[]}});await loadRoom(c)}catch(e){setMsg(e.message)}finally{setBusy(false)}}
 async function chooseCharacter(id){if(players.some(p=>p.character===id&&p.id!==me.id))return;await patchPlayer(me.id,{character:id,ready:false})}
 async function toggleReady(){await patchPlayer(me.id,{ready:!me.ready})}
 async function startGame(){setMsg('');if(players.length<2||players.some(p=>!p.ready||!p.character)){setMsg('Need 2–5 players, each ready with a unique character.');return}const deck=shuffle(buildDeck()),updates=[];let cursor=0;for(const p of players){const ch=character(p.character),hand=deck.slice(cursor,cursor+6);cursor+=6;updates.push(supabase.from('players').update({public_state:{money:ch.allowance,bars:0,space:8,played:emptyPlayed()},private_state:{hand}}).eq('id',p.id))}await Promise.all(updates);const[count,tickets]=barSetup(players.length),bars=shuffle(Array.from({length:count},(_,i)=>({id:i,ticket:i<tickets,owner:null})));await supabase.from('rooms').update({status:'playing',state:{phase:'opening_discard',turnSeat:0,actions:2,deck:deck.slice(cursor),discard:[],bars,wonkaSpace:3,log:[...(room.state.log||[]),'Game started. Each player drew 6 cards.'],pending:{},effect:{status:'idle',id:null},turnFlags:{normalActions:[],mikeOffered:false,mikeUsed:false,wonkaMovePending:false}}}).eq('code',room.code)}
 async function openingDiscard(ids){const required=me.seat===0?2:1;if(ids.length!==required)return;const st=clone(room.state),hand=me.private_state.hand.filter(c=>!ids.includes(c.id)),removed=me.private_state.hand.filter(c=>ids.includes(c.id));st.discard.push(...removed);st.pending[me.user_id]=true;st.log.push(`${me.name} confirmed the opening discard.`);if(players.every(p=>p.user_id===me.user_id||st.pending[p.user_id])){st.phase='turn';st.pending={};st.log.push(`${players[0].name}'s turn begins.`)}await commitState(st,[{id:me.id,patch:{private_state:{hand}}}])}
 function gainBars(pub,st,n,owner=me){return takeBars(st,pub,owner.user_id,n)}
 function drawInto(st,hand,n,owner=me){return drawCards(st,hand,n,owner.character)}
 function markWonka(pub,st,owner=me){
  if(pub.space!==st.wonkaSpace)return 0;
  const gained=gainBars(pub,st,1,owner);
  st.turnFlags={...(st.turnFlags||{}),wonkaMovePending:true};
  if(gained)st.log.push(`${owner.name} landed with Willy Wonka and gained 1 Wonka Bar.`);
  return gained
 }
 function landOn(st,pub,hand,actor,space,{wonka=true}={}){
  pub.space=space;
  let barsGained=wonka?markWonka(pub,st,actor):0;
  if(spaceMode(space)==='automatic'){
   const result=resolveSpaceEffect({space,state:st,actor:{...actor,...character(actor.character)},publicState:pub,hand});
   if(result.ok)barsGained+=result.barsGained||0
  }
  return {barsGained,offerSpace:spaceMode(space)==='playable'&&spaceEligibility(space,pub)}
 }
 async function resolveCard(card,choice={}){
  if(!myTurn||busy||room.state.actions<=0)return setMsg('No Action Points remaining. End your turn.');
  const st=clone(room.state),pub=clone(me.public_state),hand=clone(me.private_state.hand);
  const cardsUsed=choice.cardIds?.length?choice.cardIds:[card.id],used=hand.filter(c=>cardsUsed.includes(c.id));
  if(!used.length)return;
  const countBefore={Sweet:pub.played.Sweet.length,Rowdy:pub.played.Rowdy.length,Mystery:pub.played.Mystery.length};
  const remaining=hand.filter(c=>!cardsUsed.includes(c.id)),patches=[];
  let barsGained=0,offerSpace=null,completedSweep=false;
  const actor={...me,...character(me.character)};
  const playCards=()=>used.forEach(c=>pub.played[c.type].push(c));
  switch(card.name){
   case'Triple Cream Cup':{
    const type=choice.sweepType;
    if(!type||(pub.played[type]||[]).length<3)return setMsg('Play not available. You need 3 cards in one Player Mat category.');
    sweepNewest(st,pub,type,3);completedSweep=true;addCoins(pub,5);playCards();break
   }
   case'Fizzy Lifting Drink':{
    const corners=[1,3,7,9].filter(x=>!players.some(p=>p.id!==me.id&&p.public_state.space===x));
    if(!corners.includes(choice.space))return setMsg('Play not available. Choose an unoccupied corner.');
    playCards();({barsGained,offerSpace}=landOn(st,pub,remaining,me,choice.space));break
   }
   case'Honey Teacup':
    playCards();
    if(choice.mode==='activate')offerSpace=pub.space;
    else if(choice.mode==='move')({barsGained,offerSpace}=landOn(st,pub,remaining,me,nextSpace(pub.space,2)));
    else return setMsg('Choose Activate Space or Move 2 Spaces.');
    break;
   case'Extra Hard Rock Candy':playCards();drawInto(st,remaining,used.length>=2?4:2);break;
   case'Licorice Loop':playCards();if(hand.length===1)addCoins(pub,7);break;
   case'Wonka Vision Bar':playCards();({barsGained,offerSpace}=landOn(st,pub,remaining,me,8));barsGained+=gainBars(pub,st,1);offerSpace=null;break;
   case'Fudgemallow':playCards();addCoins(pub,used.length>=2?7:3);break;
   case'Slingshot Gum':{
    playCards();({barsGained,offerSpace}=landOn(st,pub,remaining,me,nextSpace(pub.space)));
    for(const target of players.filter(p=>p.id!==me.id&&p.public_state.space===pub.space&&p.private_state.hand.length)){
     const targetHand=clone(target.private_state.hand),stolen=randomItem(targetHand);
     remaining.push(stolen);
     patches.push({id:target.id,patch:{private_state:{hand:targetHand.filter(c=>c.id!==stolen.id)}}})
    }
    break
   }
   case'Exploding Candy':{
    const target=players.find(p=>p.id===choice.targetId&&p.id!==me.id&&(p.public_state.bars||0)>=2);
    if(!target)return setMsg('Play not available. Choose an opponent with at least 2 Wonka Bars.');
    playCards();
    const block=target.private_state.hand.find(c=>c.name==='Exploding Candy'),targetPub=clone(target.public_state);
    if(block)beginEffect(st,'exploding',{targetId:target.id},[target.user_id]);
    else{
     returnBars(st,targetPub,target.user_id,2);
     patches.push({id:target.id,patch:{public_state:targetPub}})
    }
    break
   }
   case'Slugworth Sizzler':{
    playCards();
    const affected=players.filter(p=>p.private_state.hand.length>=6);
    if(affected.length)beginEffect(st,'slugworth',{required:Object.fromEntries(affected.map(p=>[p.user_id,p.private_state.hand.length-3]))},affected.map(p=>p.user_id));
    break
   }
   case'Invisible Gumdrop':{
    playCards();barsGained+=gainBars(pub,st,used.length);
    const remainingCopies=players.map(p=>({p,count:(p.id===me.id?remaining:p.private_state.hand).filter(c=>c.name==='Invisible Gumdrop').length})).filter(x=>x.count);
    if(remainingCopies.length)beginEffect(st,'gumdrop',{},remainingCopies.filter(x=>x.count>=2).map(x=>x.p.user_id));
    break
   }
   case"Fickelgruber's Fudge":{
    const target=players.find(p=>p.id===choice.targetId&&p.id!==me.id),targetPub=target&&clone(target.public_state);
    const stolen=targetPub&&Object.values(targetPub.played).flat().find(c=>c.id===choice.cardId);
    if(!target||!stolen)return setMsg('Choose one face-up card from an eligible opponent’s Player Mat.');
    targetPub.played[stolen.type]=targetPub.played[stolen.type].filter(c=>c.id!==stolen.id);
    remaining.push(stolen);playCards();patches.push({id:target.id,patch:{public_state:targetPub}});break
   }
   case"Fickelgruber's Juicy Bar":{
    playCards();addCoins(pub,4);
    const donors=players.filter(p=>p.id!==me.id&&p.private_state.hand.length);
    if(donors.length)beginEffect(st,'juicy',{},donors.map(p=>p.user_id));
    break
   }
   case"Tug O' War Taffy":playCards();if(hand.length===1)barsGained+=gainBars(pub,st,3);break;
   case'Golden Egg':if(countBefore.Mystery>=3)barsGained+=gainBars(pub,st,3);playCards();break;
   case'Everlasting Gobstopper':if(pub.space===st.wonkaSpace)barsGained+=gainBars(pub,st,2);playCards();break;
   case'Three-Course Chewing Gum':{
    const target=players.find(p=>p.id===choice.targetId&&p.id!==me.id);
    if(!target||!choice.space||choice.space===pub.space)return setMsg('Choose another player and one of the other eight spaces.');
    const targetPub=clone(target.public_state);gainBars(targetPub,st,1,target);patches.push({id:target.id,patch:{public_state:targetPub}});
    playCards();({barsGained,offerSpace}=landOn(st,pub,remaining,me,choice.space));break
   }
   case'Lickable Wallpaper':
    playCards();if(pub.space!==st.wonkaSpace)({barsGained,offerSpace}=landOn(st,pub,remaining,me,st.wonkaSpace));break;
   case'Scrumdiddlyumptious Bar':playCards();barsGained+=gainBars(pub,st,used.length>=2?3:1);break;
   default:return setMsg(`${card.name} could not be resolved.`)
  }
  actionFinished(st,card.type);
  st.log.push(`${me.name} played ${used.length>1?`${used.length}× `:''}${card.name}.`);
  if(me.character==='violet'&&barsGained>=2)drawCards(st,remaining,1);
  await commitState(st,[{id:me.id,patch:{private_state:{hand:remaining},public_state:pub}},...patches]);
  if(st.phase==='effect'){setDialog(null);return}
  if(completedSweep&&me.character==='charlie')setDialog({type:'charlie'});
  else if(st.turnFlags.mikeOffered&&!st.turnFlags.mikeUsed)setDialog({type:'mike'});
  else if(offerSpace)setDialog({type:'spaceEffect',space:offerSpace});
  else setDialog(null)
 }
 function requestPlay(card){
  if(room.state.actions<=0)return setMsg('No Action Points remaining. End your turn.');
  const same=me.private_state.hand.filter(c=>c.name===card.name);
  if(['Scrumdiddlyumptious Bar','Fudgemallow','Extra Hard Rock Candy'].includes(card.name)&&same.length>=2)return setDialog({type:'copies',card,max:2});
  if(card.name==='Triple Cream Cup'){
   const types=['Sweet','Rowdy','Mystery'].filter(type=>(me.public_state.played[type]||[]).length>=3);
   return types.length?setDialog({type:'sweepChoice',card,types}):setDialog({type:'unavailable',message:'You need 3 cards in at least one Player Mat category.'})
  }
  if(card.name==='Fizzy Lifting Drink'){
   const spaces=[1,3,7,9].filter(x=>!players.some(p=>p.id!==me.id&&p.public_state.space===x));
   return spaces.length?setDialog({type:'space',card,spaces}):setDialog({type:'unavailable',message:'Every corner is occupied by another player.'})
  }
  if(card.name==='Honey Teacup')return setDialog({type:'honey',card});
  if(card.name==='Three-Course Chewing Gum')return setDialog({type:'targetThenSpace',card});
  if(card.name==="Fickelgruber's Fudge"){
   const targets=players.filter(p=>p.id!==me.id&&Object.values(p.public_state.played).flat().length);
   return targets.length?setDialog({type:'matSteal',card,targets}):setDialog({type:'unavailable',message:'No opponent has a card in their Player Mat.'})
  }
  if(card.name==='Exploding Candy'){
   const targets=players.filter(p=>p.id!==me.id&&(p.public_state.bars||0)>=2);
   return targets.length?setDialog({type:'target',card,targets}):setDialog({type:'unavailable',message:'No opponent has at least 2 Wonka Bars.'})
  }
  setDialog({type:'confirmPlay',card})
 }
 async function discardMove(card){
  if(!myTurn||busy||room.state.actions<=0)return setMsg('No Action Points remaining. End your turn.');
  const st=clone(room.state),hand=clone(me.private_state.hand).filter(c=>c.id!==card.id),pub=clone(me.public_state),to=nextSpace(pub.space);
  st.discard.push(card);st.actions=Math.max(0,st.actions-1);
  const landing=landOn(st,pub,hand,me,to);
  if(me.character==='violet'&&landing.barsGained>=2)drawCards(st,hand,1);
  st.turnFlags={...(st.turnFlags||{}),normalActions:[...(st.turnFlags?.normalActions||[]),'Move']};
  st.log.push(`${me.name} discarded ${card.name} and moved forward to ${SPACES[to-1].name}.`);
  await commitState(st,[{id:me.id,patch:{private_state:{hand},public_state:pub}}]);
  setDialog(landing.offerSpace?{type:'spaceEffect',space:to}:null)
 }
 async function activateSpace(space,options={}){
  if(!myTurn||busy)return;
  const st=clone(room.state),hand=clone(me.private_state.hand),pub=clone(me.public_state),actor={...me,...character(me.character)};
  const result=resolveSpaceEffect({space,state:st,actor,publicState:pub,hand,...options});
  if(!result.ok){setMsg(result.error);return}
  if(me.character==='violet'&&result.barsGained>=2)drawCards(st,hand,1);
  await commitState(st,[{id:me.id,patch:{private_state:{hand},public_state:pub}}]);
  if(result.needsDiscard)setDialog({type:'cityDiscard',space,hand});
  else if(result.swept&&me.character==='charlie')setDialog({type:'charlie'});
  else setDialog(null)
 }
 async function refill(){
  if(!myTurn||busy||room.state.actions<=0)return setMsg('No Action Points remaining. End your turn.');
  const st=clone(room.state),hand=clone(me.private_state.hand);if(hand.length>=4)return;
  drawInto(st,hand,4-hand.length);st.actions=Math.max(0,st.actions-1);
  st.turnFlags={...(st.turnFlags||{}),normalActions:[...(st.turnFlags?.normalActions||[]),'Refill']};
  st.log.push(`${me.name} refilled.`);await commitState(st,[{id:me.id,patch:{private_state:{hand}}}]);setDialog(null)
 }
 async function charlieMove(move){
  if(!move){setDialog(null);return}
  const st=clone(room.state),hand=clone(me.private_state.hand),pub=clone(me.public_state),landing=landOn(st,pub,hand,me,nextSpace(pub.space));
  st.log.push('Charlie Bucket moved forward 1 space after sweeping.');
  await commitState(st,[{id:me.id,patch:{private_state:{hand},public_state:pub}}]);setDialog(landing.offerSpace?{type:'spaceEffect',space:pub.space}:null)
 }
 async function mikeChoice(take){
  const st=clone(room.state);st.turnFlags={...(st.turnFlags||{}),mikeUsed:true};
  if(take){st.actions+=1;st.log.push('Mike Teavee took a third action.')}else st.actions=0;
  await commitState(st);setDialog(null)
 }
 async function endTurn(){
  if(!myTurn)return;const st=clone(room.state),patches=[];
  if(st.turnFlags?.wonkaMovePending){const roll=Math.floor(Math.random()*6)+1;st.wonkaSpace=nextSpace(st.wonkaSpace,roll);st.log.push(`Willy Wonka rolled ${roll} and moved to space ${st.wonkaSpace}.`)}
  if(st.bars.every(b=>b.owner)){st.phase='reveal_locked';st.actions=0;st.log.push('The final Wonka Bar was claimed. Gameplay is locked for the future Golden Ticket reveal sequence.')}
  else{
   st.turnSeat=(st.turnSeat+1)%players.length;st.actions=2;st.turnFlags={normalActions:[],mikeOffered:false,mikeUsed:false,wonkaMovePending:false};
   const upcoming=players.find(p=>p.seat===st.turnSeat);
   if(upcoming?.character==='augustus'&&upcoming.private_state.hand.length===0){
    const hand=[];drawCards(st,hand,character('augustus').refill,'augustus');
    patches.push({id:upcoming.id,patch:{private_state:{hand}}});st.log.push(`${upcoming.name} used The Investor to refill for free.`)
   }
   st.log.push(`${upcoming?.name}'s turn begins.`)
  }
  await commitState(st,patches);setDialog(null)
 }
 async function fullscreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{setMsg('Fullscreen was blocked by this browser. Use the browser menu instead.')}}
 window.__goldenTicketActivateSpace=activateSpace;
 if(!configured)return <SetupMissing/>;if(!room)return <Landing {...{name,setName,code,setCode,createRoom,joinRoom,busy,msg}}/>;if(room.state.phase==='lobby')return <Lobby {...{room,players,me,isHost,chooseCharacter,toggleReady,startGame,msg,fullscreen}}/>;if(room.state.phase==='opening_discard')return <Opening me={me} onDiscard={openingDiscard}/>;
 return <Game {...{room,players,me,myTurn,msg,busy,requestPlay,setDialog,refill,endTurn,inspect,setInspect,leftOpen,setLeftOpen,logOpen,setLogOpen,fullscreen,activateSpace,submitEffectResponse}} dialog={dialog} resolveCard={resolveCard} discardMove={discardMove} charlieMove={charlieMove} mikeChoice={mikeChoice}/>;
}

function SetupMissing(){return <main className="center"><section className="systemPanel hero"><h1>Configuration required</h1><p>Add the two public Supabase environment variables in Netlify, then redeploy.</p></section></main>}
function Landing({name,setName,code,setCode,createRoom,joinRoom,busy,msg}){return <main className="center"><section className="systemPanel hero"><div className="eyebrow">MECHANICS PLAYTEST · v0.6</div><h1>Golden Ticket Game</h1><label>Your name<input value={name} onChange={e=>setName(e.target.value)} maxLength="24"/></label><button disabled={!name||busy} onClick={createRoom}>HOST GAME</button><div className="or">— OR —</div><label>Room code<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength="5"/></label><button className="secondary" disabled={!name||code.length<5||busy} onClick={joinRoom}>JOIN GAME</button><p className="error">{msg}</p></section></main>}
function Lobby({room,players,me,isHost,chooseCharacter,toggleReady,startGame,msg,fullscreen}){return <main className="lobby"><header><b>ROOM {room.code}</b><div><span>{players.length}/5 PLAYERS</span><button className="tiny" onClick={fullscreen}>FULLSCREEN</button></div></header><section className="systemPanel"><h2>SELECT CHARACTER</h2><div className="characters">{CHARACTERS.map(c=>{const owner=players.find(p=>p.character===c.id);return <button key={c.id} className={`character ${me.character===c.id?'selected':''}`} disabled={owner&&owner.id!==me.id} onClick={()=>chooseCharacter(c.id)} style={{'--c':c.color}}><strong>{c.name}</strong><span>Allowance ${c.allowance} · Refill {c.refill}</span><small>{c.ability}</small><em>{owner?`TAKEN · ${owner.name}`:'AVAILABLE'}</em></button>})}</div><div className="players lobbyPlayers">{players.map(p=><div key={p.id}><b>{p.name}</b><span>{character(p.character)?.name||'Choosing'}</span><em>{p.ready?'READY':'NOT READY'}</em></div>)}</div><div className="actionRow"><button disabled={!me.character} onClick={toggleReady}>{me.ready?'NOT READY':'READY'}</button>{isHost&&<button className="gold" onClick={startGame}>START GAME</button>}</div><p className="error">{msg}</p></section></main>}
function Opening({me,onDiscard}){const[selected,setSelected]=useState([]),required=me.seat===0?2:1;return <main className="center"><section className="systemPanel opening"><h2>OPENING DISCARD</h2><p>Select exactly {required} card{required>1?'s':''}. The confirmation control disappears after submission.</p><Hand hand={me.private_state.hand} selected={selected} onToggle={id=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):s.length<required?[...s,id]:s)}/><button disabled={selected.length!==required} onClick={()=>onDiscard(selected)}>CONFIRM DISCARD</button></section></main>}
function Hand({hand,selected=[],onToggle,onPlay,onMove}){return <div className="hand">{hand.map(c=><article key={c.id} className={`card ${c.type.toLowerCase()} ${selected.includes(c.id)?'selected':''}`} onClick={()=>onToggle?.(c.id)}><span>{c.type.toUpperCase()}</span><strong>{c.name}</strong><small>{c.effect}</small>{onPlay&&<div className="cardActions"><button onClick={e=>{e.stopPropagation();onPlay(c)}}>PLAY</button><button className="secondary" onClick={e=>{e.stopPropagation();onMove(c)}}>MOVE</button></div>}</article>)}</div>}
function PlayerMat({me,myTurn,actions,requestPlay,setDialog,refill,players,setInspect}){const ch=character(me.character),canAct=myTurn&&actions>0;return <><section className="identity"><div><div className="eyebrow">YOUR CHARACTER</div><h2>{ch?.name}</h2><p>{ch?.ability}</p></div><div className="stats"><span>${me.public_state.money}</span><span>ALLOWANCE ${ch?.allowance}</span><span>{me.public_state.bars} BARS</span><span>{actions} AP</span><span>{me.private_state.hand.length} CARDS</span></div></section><section><h3>HAND</h3><Hand hand={me.private_state.hand} onPlay={canAct?requestPlay:null} onMove={canAct?()=>setDialog({type:'moveSelect'}):null}/>{myTurn&&<button className="wide" disabled={!canAct||me.private_state.hand.length>=4} onClick={refill}>REFILL HAND</button>}</section><section><h3>PLAYER MAT</h3>{['Sweet','Rowdy','Mystery'].map(type=><div className="matCategory" key={type}><div><b>{type}</b><span>{(me.public_state.played[type]||[]).length} cards</span></div><div className="miniCards">{(me.public_state.played[type]||[]).map((c,i)=><span key={c.id}>{i+1}. {c.name}</span>)}</div><button disabled>{type.toUpperCase()} SWEEP</button></div>)}</section><section><h3>PLAYERS</h3><div className="playerList">{players.map(p=><div key={p.id}><div><b>{p.name}</b><small>{character(p.character)?.name}</small></div><span>${p.public_state.money} · {p.public_state.bars} bars</span><button className="selectButton" disabled>SELECT</button><button className="tiny" onClick={()=>setInspect(p)}>VIEW</button></div>)}</div></section></>}
function Board({st,players,me}){const remaining=st.bars.filter(b=>b.owner===null).length;return <><div className="pileRow"><div className="pile"><b>DRAW</b><span>{st.deck.length}</span></div><div className="pile discard"><b>DISCARD</b><span>{st.discard.length}</span></div></div><section className="board">{SPACES.map(s=><article key={s.id} className={`space ${st.wonkaSpace===s.id?'wonka':''} ${me.public_state.space===s.id?'you':''}`}><b>{s.id}. {s.name}</b><small>{s.effect}</small><div className="pawns">{players.filter(p=>p.public_state.space===s.id).map(p=><span className="pawn" title={p.name} key={p.id}>{p.name[0].toUpperCase()}</span>)}{st.wonkaSpace===s.id&&<span className="pawn wonkaPawn">W</span>}</div></article>)}</section><div className="wonkaCounter"><b>WONKA BARS REMAINING</b><span>{remaining}</span></div></>}
function Game({room,players,me,myTurn,msg,busy,requestPlay,setDialog,refill,endTurn,inspect,setInspect,leftOpen,setLeftOpen,logOpen,setLogOpen,fullscreen,dialog,resolveCard,discardMove,activateSpace,charlieMove,mikeChoice,submitEffectResponse}){const st=room.state,winners=st.phase==='ended'?players.filter(p=>st.bars.some(b=>b.owner===p.user_id&&b.ticket)):[],effect=st.effect?.status==='collecting'?st.effect:null;return <main className="gameShell"><header><b>ROOM {room.code}</b><span>{st.phase==='ended'?'GAME OVER':effect?'MULTIPLAYER EVENT':myTurn?`YOUR TURN · ${st.actions} AP`:`${players.find(p=>p.seat===st.turnSeat)?.name}'S TURN`}</span><div><button className="tiny" onClick={()=>setLeftOpen(!leftOpen)}>MAT</button><button className="tiny" onClick={()=>setLogOpen(!logOpen)}>LOG</button><button className="tiny" onClick={fullscreen}>FULLSCREEN</button></div></header>{st.phase==='ended'&&<section className="systemPanel winner"><h2>{winners.length?`${winners.map(w=>w.name).join(' & ')} WON!`:'NO TICKET WINNER'}</h2></section>}<div className={`gameGrid ${!leftOpen?'leftCollapsed':''} ${!logOpen?'logCollapsed':''}`}><aside className={`sidePanel leftPanel ${leftOpen?'open':''}`}><PlayerMat {...{me,myTurn,requestPlay,setDialog,refill,players,setInspect}} actions={st.actions}/></aside><section className="boardPanel"><Board st={st} players={players} me={me}/>{myTurn&&<div className="turnBar"><span>{st.actions<=0?'No AP remaining — end your turn.':''}</span><button className="gold" disabled={busy} onClick={()=>setDialog({type:'endTurn'})}>END TURN</button></div>}<p className="error">{msg}</p></section><aside className={`sidePanel logPanel ${logOpen?'open':''}`}><h3>GAME LOG</h3>{[...(st.log||[])].reverse().map((x,i)=><p key={i}>{x}</p>)}</aside></div>{inspect&&<Dialog title={inspect.name.toUpperCase()} onClose={()=>setInspect(null)}><p>{character(inspect.character)?.ability}</p><p>${inspect.public_state.money} · {inspect.public_state.bars} bars · {inspect.private_state.hand.length} cards</p>{Object.entries(inspect.public_state.played).map(([t,c])=><p key={t}><b>{t}:</b> {c.length}</p>)}</Dialog>}{effect&&<EffectDialog {...{effect,me,players,busy,submitEffectResponse}}/>}{!effect&&dialog&&<GameDialog {...{dialog,me,players,st,onClose:()=>setDialog(null),resolveCard,discardMove,endTurn,activateSpace,charlieMove,mikeChoice}}/>}</main>}
function Dialog({title,children,onClose}){return <div className="overlay" role="dialog" aria-modal="true"><section className="dialog"><div className="dialogHead"><span>SYSTEM</span><button className="tiny" onClick={onClose}>×</button></div><h2>{title}</h2>{children}</section></div>}
function EffectDialog({effect,me,players,busy,submitEffectResponse}){
 const[selected,setSelected]=useState([]),[giving,setGiving]=useState(false),answer=responseFor(me,effect.id);
 const responded=effect.eligible.filter(uid=>responseFor(players.find(p=>p.user_id===uid),effect.id)).length;
 const waiting=<Dialog title="WAITING FOR PLAYERS"><p>Your response is locked in.</p><p>{responded} of {effect.eligible.length} required responses received.</p></Dialog>;
 if(!effect.eligible.includes(me.user_id))return <Dialog title="MULTIPLAYER EVENT"><p>{effect.type==='gumdrop'?'Eligible players are choosing how many Invisible Gumdrops to play.':'Waiting for the affected players to respond.'}</p><p>{responded} of {effect.eligible.length} responses received.</p></Dialog>;
 if(answer)return waiting;
 if(effect.type==='exploding'){
  const blocks=me.private_state.hand.filter(c=>c.name==='Exploding Candy');
  return <Dialog title="EXPLODING CANDY!"><p>You have been targeted.</p><div className="actionRow"><button disabled={busy||!blocks.length} onClick={()=>submitEffectResponse({choice:'block',cardId:blocks[0]?.id})}>PLAY EXPLODING CANDY TO BLOCK</button><button className="secondary" disabled={busy} onClick={()=>submitEffectResponse({choice:'accept'})}>ACCEPT ATTACK</button></div></Dialog>
 }
 if(effect.type==='slugworth'){
  const required=effect.meta.required[me.user_id];
  const toggle=id=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):s.length<required?[...s,id]:s);
  return <Dialog title="SLUGWORTH SIZZLER"><p>Discard exactly {required} card{required===1?'':'s'} to finish with 3.</p><Hand hand={me.private_state.hand} selected={selected} onToggle={toggle}/><button className="wide" disabled={busy||selected.length!==required} onClick={()=>submitEffectResponse({discardIds:selected})}>CONFIRM DISCARD</button></Dialog>
 }
 if(effect.type==='gumdrop'){
  const copies=me.private_state.hand.filter(c=>c.name==='Invisible Gumdrop');
  return <Dialog title="INVISIBLE GUMDROP"><p>You must play at least one copy.</p><div className="choiceGrid"><button disabled={busy} onClick={()=>submitEffectResponse({amount:1})}>PLAY 1</button><button disabled={busy||copies.length<2} onClick={()=>submitEffectResponse({amount:copies.length})}>PLAY ALL ({copies.length})</button></div></Dialog>
 }
 if(effect.type==='juicy'){
  const toggle=id=>setSelected(s=>s.includes(id)?[]:[id]);
  return <Dialog title="FICKELGRUBER'S JUICY BAR">{!giving?<><p>Give one card to gain 2 coins?</p><div className="actionRow"><button disabled={busy} onClick={()=>setGiving(true)}>GIVE 1 CARD</button><button className="secondary" disabled={busy} onClick={()=>submitEffectResponse({choice:'none'})}>NO CARD</button></div></>:<><p>Select exactly one card to give.</p><Hand hand={me.private_state.hand} selected={selected} onToggle={toggle}/><div className="actionRow"><button disabled={busy||selected.length!==1} onClick={()=>submitEffectResponse({choice:'give',cardId:selected[0]})}>GIVE CARD</button><button className="secondary" onClick={()=>setGiving(false)}>BACK</button></div></>}</Dialog>
 }
 return waiting
}
function GameDialog({dialog,me,players,st,onClose,resolveCard,discardMove,endTurn,activateSpace,charlieMove,mikeChoice}){
 const[selected,setSelected]=useState([]),[targetId,setTargetId]=useState(''),[space,setSpace]=useState(null),[sweepCount,setSweepCount]=useState(0);
 const same=dialog.card?me.private_state.hand.filter(c=>c.name===dialog.card.name):[];
 const toggle=(id,max=Infinity)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):s.length<max?[...s,id]:s);
 if(dialog.type==='confirmPlay')return <Dialog title={`PLAY ${dialog.card.name}?`} onClose={onClose}><p>{dialog.card.effect}</p><div className="actionRow"><button onClick={()=>resolveCard(dialog.card)}>CONFIRM</button><button className="secondary" onClick={onClose}>CANCEL</button></div></Dialog>;
 if(dialog.type==='unavailable')return <Dialog title="PLAY NOT AVAILABLE" onClose={onClose}><p>{dialog.message}</p><button className="secondary wide" onClick={onClose}>CLOSE</button></Dialog>;
 if(dialog.type==='copies')return <Dialog title={dialog.card.name.toUpperCase()} onClose={dialog.noCancel?undefined:onClose}><p>Choose the combined play. It costs 1 AP total.</p><div className="choiceGrid">{Array.from({length:dialog.max},(_,i)=>i+1).map(n=><button key={n} onClick={()=>resolveCard(dialog.card,{cardIds:same.slice(0,n).map(c=>c.id)})}>PLAY {n}</button>)}</div>{!dialog.noCancel&&<button className="secondary wide" onClick={onClose}>CANCEL</button>}</Dialog>;
 if(dialog.type==='space')return <Dialog title="CHOOSE A SPACE" onClose={onClose}><div className="choiceGrid">{dialog.spaces.map(n=><button key={n} onClick={()=>resolveCard(dialog.card,{space:n})}>{n}. {SPACES[n-1].name}</button>)}</div><button className="secondary wide" onClick={onClose}>CANCEL</button></Dialog>;
 if(dialog.type==='honey')return <Dialog title="HONEY TEACUP" onClose={onClose}><div className="choiceGrid"><button onClick={()=>resolveCard(dialog.card,{mode:'activate'})}>ACTIVATE SPACE</button><button onClick={()=>resolveCard(dialog.card,{mode:'move'})}>MOVE 2 SPACES</button></div><button className="secondary wide" onClick={onClose}>CANCEL</button></Dialog>;
 if(dialog.type==='sweepChoice')return <Dialog title="TRIPLE CREAM CUP" onClose={onClose}><p>Choose one qualifying category. The 3 newest cards will be swept.</p><div className="choiceGrid">{dialog.types.map(type=><button key={type} onClick={()=>resolveCard(dialog.card,{sweepType:type})}>SWEEP {type.toUpperCase()}</button>)}</div><button className="secondary wide" onClick={onClose}>CANCEL</button></Dialog>;
 if(dialog.type==='target')return <Dialog title={targetId?'CONFIRM ATTACK':'CHOOSE A PLAYER'} onClose={onClose}>{!targetId?<div className="targetList">{(dialog.targets||players.filter(p=>p.id!==me.id)).map(p=><button key={p.id} onClick={()=>dialog.card.name==='Exploding Candy'?setTargetId(p.id):resolveCard(dialog.card,{targetId:p.id})}>{p.name}</button>)}</div>:<><p>Attack {players.find(p=>p.id===targetId)?.name} with Exploding Candy?</p><button className="wide" onClick={()=>resolveCard(dialog.card,{targetId})}>CONFIRM ATTACK</button></>}<button className="secondary wide" onClick={onClose}>CANCEL</button></Dialog>;
 if(dialog.type==='targetThenSpace')return <Dialog title={targetId?'CHOOSE A SPACE':'CHOOSE A PLAYER'} onClose={onClose}>{!targetId?<div className="targetList">{players.filter(p=>p.id!==me.id).map(p=><button key={p.id} onClick={()=>setTargetId(p.id)}>{p.name}</button>)}</div>:<div className="choiceGrid">{SPACES.filter(s=>s.id!==me.public_state.space).map(s=><button key={s.id} onClick={()=>resolveCard(dialog.card,{targetId,space:s.id})}>{s.id}. {s.name}</button>)}</div>}<button className="secondary wide" onClick={onClose}>CANCEL</button></Dialog>;
 if(dialog.type==='matSteal'){
  const targets=dialog.targets||[],target=targets.find(p=>p.id===targetId),cards=target?Object.values(target.public_state.played).flat():[];
  return <Dialog title={target?'CHOOSE A CARD':'CHOOSE A PLAYER'} onClose={onClose}>{!target?<div className="targetList">{targets.map(p=><button key={p.id} onClick={()=>setTargetId(p.id)}>{p.name}</button>)}</div>:<><div className="choiceGrid">{cards.map(c=><button className={selected.includes(c.id)?'selectedChoice':''} key={c.id} onClick={()=>setSelected([c.id])}>{c.type}: {c.name}</button>)}</div><button className="wide" disabled={selected.length!==1} onClick={()=>resolveCard(dialog.card,{targetId,cardId:selected[0]})}>TAKE CARD</button></>}<button className="secondary wide" onClick={onClose}>CANCEL</button></Dialog>
 }
 if(dialog.type==='moveSelect')return <Dialog title="DISCARD TO MOVE" onClose={onClose}><p>Select exactly one card.</p><Hand hand={me.private_state.hand} selected={selected} onToggle={id=>toggle(id,1)}/><div className="actionRow"><button disabled={selected.length!==1} onClick={()=>discardMove(me.private_state.hand.find(c=>c.id===selected[0]))}>CONFIRM</button><button className="secondary" onClick={onClose}>CANCEL</button></div></Dialog>;
 if(dialog.type==='spaceEffect'){
  const available=(me.public_state.played.Rowdy||[]).length,auction=[2,3,4].filter(n=>n<=available);
  return <Dialog title="SPACE ABILITY" onClose={onClose}><p>{SPACES[dialog.space-1].effect}</p>{dialog.space===9&&<div className="choiceGrid">{auction.map(n=><button className={sweepCount===n?'selectedChoice':''} key={n} onClick={()=>setSweepCount(n)}>SWEEP {n} → GAIN {n} BARS</button>)}</div>}<div className="actionRow"><button disabled={dialog.space===9&&!sweepCount} onClick={()=>activateSpace(dialog.space,{sweepCount})}>ACTIVATE SPACE</button><button className="secondary" onClick={onClose}>SKIP EFFECT</button></div></Dialog>
 }
 if(dialog.type==='cityDiscard')return <Dialog title="DISCARD 2 CARDS" onClose={()=>{}}><p>Select exactly 2 cards from your full hand.</p><Hand hand={dialog.hand} selected={selected} onToggle={id=>toggle(id,2)}/><button className="wide" disabled={selected.length!==2} onClick={()=>activateSpace(5,{discardIds:selected})}>CONFIRM</button></Dialog>;
 if(dialog.type==='globalDiscard'){
  const affected=players.filter(p=>p.private_state.hand.length>=6),required=affected.reduce((n,p)=>n+p.private_state.hand.length-3,0);
  return <Dialog title="SLUGWORTH SIZZLER" onClose={onClose}><p>Select each affected player’s discards. This resolution waits for exactly {required} total choices.</p>{affected.map(p=><section key={p.id}><b>{p.name}: choose {p.private_state.hand.length-3}</b><Hand hand={p.private_state.hand} selected={selected} onToggle={id=>toggle(id,required)}/></section>)}<button className="wide" disabled={selected.length!==required} onClick={()=>resolveCard(dialog.card,{discards:Object.fromEntries(affected.map(p=>[p.id,selected.filter(id=>p.private_state.hand.some(c=>c.id===id))]))})}>CONFIRM ALL</button><button className="secondary wide" onClick={onClose}>CANCEL</button></Dialog>
 }
 if(dialog.type==='juicy')return <Dialog title="FICKLEGRUBER'S JUICY BAR" onClose={onClose}><p>Gain 4 coins. Optionally select up to one card from each opponent to give you for 2 coins.</p>{players.filter(p=>p.id!==me.id&&p.private_state.hand.length).map(p=><section key={p.id}><b>{p.name}</b><Hand hand={p.private_state.hand} selected={selected} onToggle={id=>{const other=p.private_state.hand.some(c=>selected.includes(c.id));setSelected(s=>other?s.filter(x=>!p.private_state.hand.some(c=>c.id===x)):[...s,id])}}/></section>)}<button className="wide" onClick={()=>resolveCard(dialog.card,{gifts:Object.fromEntries(players.map(p=>[p.id,selected.find(id=>p.private_state.hand.some(c=>c.id===id))]))})}>CONFIRM RESPONSES</button><button className="secondary wide" onClick={onClose}>CANCEL</button></Dialog>;
 if(dialog.type==='charlie')return <Dialog title="CHARLIE'S ABILITY" onClose={()=>charlieMove(false)}><p>Move forward 1 space?</p><div className="actionRow"><button onClick={()=>charlieMove(true)}>MOVE 1 SPACE</button><button className="secondary" onClick={()=>charlieMove(false)}>STAY HERE</button></div></Dialog>;
 if(dialog.type==='mike')return <Dialog title="MIKE'S ABILITY" onClose={()=>mikeChoice(false)}><p>Both actions were Rowdy cards. Take a third action?</p><div className="actionRow"><button onClick={()=>mikeChoice(true)}>TAKE THIRD ACTION</button><button className="secondary" onClick={()=>mikeChoice(false)}>END TURN</button></div></Dialog>;
 if(dialog.type==='endTurn')return <Dialog title="END TURN?" onClose={onClose}><p>Willy Wonka moves only if someone landed on his space this turn.</p><div className="actionRow"><button className="gold" onClick={endTurn}>END TURN</button><button className="secondary" onClick={onClose}>CANCEL</button></div></Dialog>;
 return null
}
createRoot(document.getElementById('root')).render(<App/>);
