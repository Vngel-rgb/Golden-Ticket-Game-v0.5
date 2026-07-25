import {SPACES,shuffle} from './gameData.js';

export const COIN_CAP=30;
export const nextSpace=(space,steps=1)=>((space-1+steps)%9)+1;
export const addCoins=(publicState,amount)=>{
  const before=publicState.money||0;
  publicState.money=Math.min(COIN_CAP,before+Math.max(0,amount));
  return publicState.money-before;
};

export function drawCards(state,hand,count,characterId){
  const requested=count+(characterId==='veruca'?1:0);
  let drawn=0;
  for(let i=0;i<requested;i++){
    if(!state.deck.length&&state.discard.length){
      state.deck=shuffle(state.discard);
      state.discard=[];
    }
    if(state.deck.length){hand.push(state.deck.shift());drawn++}
  }
  return drawn;
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

export function sweepNewest(state,publicState,type,count){
  const stack=publicState.played[type]||[];
  if(stack.length<count)return [];
  const swept=stack.slice(-count).reverse();
  publicState.played[type]=stack.slice(0,-count);
  state.discard.push(...swept);
  return swept;
}

export function spaceEligibility(space,publicState){
  switch(space){
    case 1:return (publicState.money||0)>=14;
    case 2:return (publicState.money||0)>=3;
    case 3:return (publicState.played.Mystery||[]).length>=2;
    case 4:return (publicState.played.Sweet||[]).length>=3;
    case 5:return true;
    case 6:return (publicState.money||0)>=5;
    case 7:
    case 8:return true;
    case 9:return (publicState.played.Rowdy||[]).length>=2;
    default:return false;
  }
}

export function spaceMode(space){
  return [7,8].includes(space)?'automatic':'playable';
}

export function resolveSpaceEffect({space,state,actor,publicState,hand,sweepCount=0,discardIds=[]}){
  if(!spaceEligibility(space,publicState))return {ok:false,error:'This Space Ability is not currently available.'};
  let barsGained=0,swept=0,needsDiscard=false;
  switch(space){
    case 1:
      publicState.money-=14;
      barsGained=takeBars(state,publicState,actor.user_id,6);
      break;
    case 2:
      publicState.money-=3;
      barsGained=takeBars(state,publicState,actor.user_id,2);
      break;
    case 3:
      swept=sweepNewest(state,publicState,'Mystery',2).length;
      barsGained=takeBars(state,publicState,actor.user_id,2);
      break;
    case 4:
      swept=sweepNewest(state,publicState,'Sweet',3).length;
      barsGained=takeBars(state,publicState,actor.user_id,2);
      break;
    case 5:
      if(!discardIds.length){
        drawCards(state,hand,3,actor.character);
        return {ok:true,needsDiscard:true,barsGained:0,swept:0};
      }
      if(discardIds.length!==2)return {ok:false,error:'Select exactly 2 cards.'};
      state.discard.push(...hand.filter(c=>discardIds.includes(c.id)));
      hand.splice(0,hand.length,...hand.filter(c=>!discardIds.includes(c.id)));
      needsDiscard=false;
      break;
    case 6:
      publicState.money-=5;
      drawCards(state,hand,3,actor.character);
      break;
    case 7:
      addCoins(publicState,4);
      break;
    case 8:
      addCoins(publicState,actor.allowance);
      break;
    case 9:{
      const available=(publicState.played.Rowdy||[]).length;
      if(sweepCount<2||sweepCount>Math.min(4,available))return {ok:false,error:'Choose a legal sweep amount from 2 to 4.'};
      swept=sweepNewest(state,publicState,'Rowdy',sweepCount).length;
      barsGained=takeBars(state,publicState,actor.user_id,swept);
      break;
    }
    default:return {ok:false,error:`Unknown board space ${space}.`};
  }
  state.log.push(`${actor.name} activated ${SPACES[space-1].name}.`);
  return {ok:true,barsGained,swept,needsDiscard};
}
