export const CHARACTERS=[
{id:'violet',name:'Violet Beauregarde',title:'The Snowball',allowance:5,refill:4,color:'#3157b7',ability:'After gaining 2+ Wonka Bars from one completed effect, automatically draw 1 card.'},
{id:'augustus',name:'Augustus Gloop',title:'The Investor',allowance:5,refill:4,color:'#2e7d4f',ability:'At the start of his turn, if his hand is empty, refill for free.'},
{id:'charlie',name:'Charlie Bucket',title:'The Sweep Demon',allowance:3,refill:4,color:'#7a5436',ability:'After completing a sweep, he may move forward 1 space for free.'},
{id:'veruca',name:'Veruca Salt',title:'The Opportunist',allowance:8,refill:4,color:'#bd3037',ability:'Whenever instructed to draw cards, draw exactly 1 additional card.'},
{id:'mike',name:'Mike Teavee',title:'The Combo Player',allowance:5,refill:4,color:'#d1a91e',ability:'After his first two normal actions are both Rowdy plays, he may take a third action.'}
];
export const SPACES=[
{id:1,name:"Mr. Joe Peck's Newsstand",effect:'Spend $14, then gain 6 Wonka Bars.'},
{id:2,name:'The Market',effect:'Spend $3, then gain 2 Wonka Bars.'},
{id:3,name:'Wonka Factory Gates',effect:'Sweep 2 Mystery cards, then gain 2 Wonka Bars.'},
{id:4,name:'TV Shop',effect:'Sweep 3 Sweet cards, then gain 2 Wonka Bars.'},
{id:5,name:'City Square',effect:'Draw 3 cards, then discard 2 from your hand.'},
{id:6,name:'Candy Shop',effect:'Spend $5, then draw 3 cards.'},
{id:7,name:'Snack Delivery',effect:'Gain $4.'},
{id:8,name:'Classroom',effect:'Gain coins equal to your character allowance.'},
{id:9,name:'Auction House',effect:'Sweep 2–4 Rowdy cards; gain 1 Wonka Bar per card swept.'}
];
const defs=[
['Sweet','Fizzy Lifting Drink',4,'Move to any unoccupied corner space.'],['Sweet','Honey Teacup',8,'Activate your current space OR move 2 spaces.'],['Sweet','Extra Hard Rock Candy',6,'Draw 2 cards OR play 2 together to draw 4.'],['Sweet','Triple Cream Cup',6,'Sweep 3 cards of one category and gain $5.'],['Sweet','Licorice Loop',2,'If final card in hand, gain $7.'],['Sweet','Wonka Vision Bar',2,'Move to Classroom, then gain 1 Wonka Bar.'],['Sweet','Fudgemallow',8,'Gain $3 OR play 2 together to gain $7.'],
['Rowdy','Slingshot Gum',6,'Move 1 space, then take 1 random card from everyone on your space.'],['Rowdy','Exploding Candy',6,'Make someone return 2 Wonka Bars OR block another Exploding Candy.'],['Rowdy','Slugworth Sizzler',2,'Everyone with 6+ cards discards down to 3.'],['Rowdy','Invisible Gumdrop',8,'Anyone may play all copies and gain 1 Wonka Bar per copy.'],["Rowdy","Fickelgruber's Fudge",2,"Take a card from below someone else's mat."],["Rowdy","Fickelgruber's Juicy Bar",4,'Gain $4. Others may give you a card to gain $2.'],
['Mystery',"Tug O' War Taffy",2,'If final card in hand, gain 3 Wonka Bars.'],['Mystery','Golden Egg',2,'If you have 3 other Mystery cards below your mat, gain 3 Wonka Bars.'],['Mystery','Everlasting Gobstopper',2,'If Willy Wonka is on your space, gain 2 Wonka Bars.'],['Mystery','Three-Course Chewing Gum',4,'Choose someone else to gain 1 Wonka Bar, then move to any space.'],['Mystery','Lickable Wallpaper',6,"If not on Willy Wonka's space, move there."],['Mystery','Scrumdiddlyumptious Bar',6,'Gain 1 Wonka Bar OR play 2 together to gain 3.']
];
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
export const buildDeck=()=>defs.flatMap(([type,name,count,effect])=>Array.from({length:count},(_,i)=>({id:`${slug(name)}-${i}-${crypto.randomUUID()}`,cardId:slug(name),type,name,effect})));
export const shuffle=a=>{const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;};
export const barSetup=n=>({2:[34,1],3:[41,2],4:[48,3],5:[55,4]}[n]||[34,1]);
