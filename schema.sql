import {SPACES,shuffle} from './gameData.js';

const random=a=>a[Math.floor(Math.random()*a.length)];
const next=n=>n===9?1:n+1;

export function drawCards(state,hand,count){
  for(let i=0;i<count;i++){
    if(!state.deck.length&&state.discard.length){
      state.deck=shuffle(state.discard);
      state.discard=[];
    }
    if(state.deck.length)hand.push(state.deck.shift());
  }
}

export function takeBars(state,publicState,userId,count){
  let gained=0;
  for(const bar of state.bars.filter(b=>b.owner===null).slice(0,count)){
    bar.owner=userId;
    publicState.bars=(publicState.bars||0)+1;
    gained++;
  }
  return gained;
}

export function returnBars(state,publicState,userId,count){
  const owned=state.bars.filter(b=>b.owner===userId).slice(0,count);
  owned.forEach(b=>{b.owner=null});
  publicState.bars=Math.max(0,(publicState.bars||0)-owned.length);
  return owned.length;
}

export function resolveAdvancedCard({card,state,actor,actorPublic,actorHand,players,choice={}}){
  const patches=[];
  const log=text=>state.log.push(text);
  switch(card.name){
    case 'Triple-Cream Cup':{
      const available=Object.values(actorPublic.played).flat().filter(c=>c.id!==card.id);
      if(available.length<3)return {error:'You need three other cards below your mat.'};
      const swept=available.slice(0,3);
      for(const c of swept)actorPublic.played[c.type]=actorPublic.played[c.type].filter(x=>x.id!==c.id);
      state.discard.push(...swept);
      actorPublic.money+=5;
      log(`${actor.name} swept 3 cards and gained $5.`);
      break;
    }
    case 'Slingshot Gum':{
      actorPublic.space=next(actorPublic.space);
      for(const target of players.filter(p=>p.id!==actor.id&&p.public_state.space===actorPublic.space&&p.private_state.hand.length)){
        const hand=[...target.private_state.hand],stolen=random(hand);
        actorHand.push(stolen);
        patches.push({id:target.id,patch:{private_state:{hand:hand.filter(c=>c.id!==stolen.id)}}});
      }
      break;
    }
    case 'Exploding Candy':{
      const target=players.find(p=>p.id===choice.targetId);
      if(!target)return {error:'Choose another player.'};
      const hand=[...target.private_state.hand],block=hand.find(c=>c.name==='Exploding Candy');
      const pub=structuredClone(target.public_state);
      if(block){
        pub.played.Rowdy.push(block);
        patches.push({id:target.id,patch:{private_state:{hand:hand.filter(c=>c.id!==block.id)},public_state:pub}});
        log(`${target.name} blocked the attack with Exploding Candy.`);
      }else{
        const returned=returnBars(state,pub,target.user_id,2);
        patches.push({id:target.id,patch:{public_state:pub}});
        log(`${target.name} returned ${returned} Wonka Bar(s).`);
      }
      break;
    }
    case 'Slugworth Sizzler':{
      for(const target of players.filter(p=>p.private_state.hand.length>=6)){
        const hand=[...target.private_state.hand],discarded=shuffle(hand).slice(0,hand.length-3);
        state.discard.push(...discarded);
        patches.push({id:target.id,patch:{private_state:{hand:hand.filter(c=>!discarded.some(d=>d.id===c.id))}}});
      }
      break;
    }
    case "Fickelgruber's Fudge":{
      const target=players.find(p=>p.id===choice.targetId);
      if(!target)return {error:'Choose another player.'};
      const pub=structuredClone(target.public_state),available=Object.values(pub.played).flat();
      if(!available.length)return {error:`${target.name} has no cards below their mat.`};
      const stolen=random(available);
      pub.played[stolen.type]=pub.played[stolen.type].filter(c=>c.id!==stolen.id);
      actorPublic.played[stolen.type].push(stolen);
      patches.push({id:target.id,patch:{public_state:pub}});
      break;
    }
    case "Fickelgruber's Juicy Bar":{
      actorPublic.money+=4;
      const target=players.find(p=>p.id===choice.targetId);
      if(target?.private_state.hand.length){
        const hand=[...target.private_state.hand],gift=random(hand),pub=structuredClone(target.public_state);
        actorHand.push(gift);
        pub.money+=2;
        patches.push({id:target.id,patch:{private_state:{hand:hand.filter(c=>c.id!==gift.id)},public_state:pub}});
      }
      break;
    }
    default:
      return {error:`${card.name} could not be resolved.`};
  }
  return {patches};
}

export function resolveSpaceEffect({space,state,actor,publicState,hand,sweepCards=[]}){
  const discardSweep=(type,count)=>{
    const cards=(publicState.played[type]||[]).slice(0,count);
    if(cards.length<count)return false;
    publicState.played[type]=publicState.played[type].slice(count);
    state.discard.push(...cards);
    return true;
  };
  let result={ok:true,gained:0};
  switch(space){
    case 1:
      if(publicState.money<14)return {ok:false,error:'You need $14.'};
      publicState.money-=14; result.gained=takeBars(state,publicState,actor.user_id,6); break;
    case 2:
      if(publicState.money<3)return {ok:false,error:'You need $3.'};
      publicState.money-=3; result.gained=takeBars(state,publicState,actor.user_id,2); break;
    case 3:
      if(!discardSweep('Mystery',2))return {ok:false,error:'You need 2 Mystery cards below your mat.'};
      result.gained=takeBars(state,publicState,actor.user_id,2); break;
    case 4:
      if(!discardSweep('Sweet',3))return {ok:false,error:'You need 3 Sweet cards below your mat.'};
      result.gained=takeBars(state,publicState,actor.user_id,2); break;
    case 5:{
      drawCards(state,hand,3);
      const discard=hand.slice(0,Math.min(2,hand.length));
      state.discard.push(...discard);
      hand.splice(0,discard.length);
      break;
    }
    case 6:
      if(publicState.money<5)return {ok:false,error:'You need $5.'};
      publicState.money-=5; drawCards(state,hand,3); break;
    case 7: publicState.money+=4; break;
    case 8: publicState.money=Math.max(publicState.money,actor.allowance); break;
    case 9:{
      const count=Math.min(4,sweepCards.length||(publicState.played.Rowdy||[]).length);
      if(!count)return {ok:false,error:'You have no Rowdy cards to sweep.'};
      const cards=publicState.played.Rowdy.slice(0,count);
      publicState.played.Rowdy=publicState.played.Rowdy.slice(count);
      state.discard.push(...cards);
      result.gained=takeBars(state,publicState,actor.user_id,count);
      break;
    }
    default:return {ok:false,error:`Unknown board space ${space}.`};
  }
  state.log.push(`${actor.name} activated ${SPACES[space-1].name}.`);
  return result;
}
