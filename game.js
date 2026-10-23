'use strict';
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const ui = Object.fromEntries(['score', 'coins', 'lives', 'overlay', 'title', 'message', 'play', 'pause'].map(id => [id, document.getElementById(id)]));
  const W = 960, H = 540, FLOOR = 456, WORLD = 4400;
  const keys = { left: false, right: false, jump: false };
  let state = 'ready', player, solids, enemies, coins, particles, popups;
  let score = 0, collected = 0, lives = 3, camera = 0, time = 0, jumpBuffer = 0, coyote = 0;
  const pits = [[1040, 1160], [2190, 2320], [3300, 3440]];
  const flag = { x: 4180, y: 208, w: 15, h: 248 };
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function hud() {
    ui.score.textContent = String(score).padStart(6, '0');
    ui.coins.textContent = String(collected).padStart(2, '0');
    ui.lives.textContent = '♥ '.repeat(lives).trim() || '—';
    ui.pause.textContent = state === 'paused' ? '继续' : '暂停';
  }
  function reset() {
    score = 0; collected = 0; lives = 3; camera = 0; time = 0;
    solids = []; enemies = []; coins = []; particles = []; popups = [];
    let start = 0;
    for (const [a, b] of pits) { solids.push({x:start,y:FLOOR,w:a-start,h:H-FLOOR,type:'ground'}); start=b; }
    solids.push({x:start,y:FLOOR,w:WORLD-start,h:H-FLOOR,type:'ground'});
    const block = (x,y,type='brick') => solids.push({x,y,w:40,h:40,type,bump:0});
    [360,400,480,520,760,800,1440,1480,1560,1880,1920,2640,2680,2760,3040,3080,3680].forEach(x => block(x, x===760 || x===800 || x===1880 || x===1920 ? 280 : 328));
    [440,1520,2720,3720].forEach(x=>block(x,328,'question'));
    [[650,376,80,80],[1250,356,80,100],[1990,376,80,80],[2880,356,80,100],[3860,376,80,80]].forEach(([x,y,w,h])=>solids.push({x,y,w,h,type:'pipe'}));
    [[900,368,120],[1710,350,120],[2390,375,160],[3140,350,120],[3500,376,120]].forEach(([x,y,w])=>solids.push({x,y,w,h:20,type:'platform'}));
    const coin = (x,y)=>coins.push({x,y,w:18,h:24,taken:false});
    [220,260,300,390,440,490,780,925,965,1100,1460,1520,1580,1740,1780,1900,2255,2420,2460,2500,2670,2730,2790,3050,3170,3210,3370,3530,3570,3710,3990,4030,4070].forEach(x=>coin(x, pits.some(([a,b])=>x>a&&x<b)?310:(x<340||x>3950?405:265)));
    [[540,500,625],[850,820,1010],[1380,1350,1650],[1820,1700,1950],[2570,2545,2830],[2980,2960,3250],[3650,3630,3830],[4000,3960,4140]].forEach(([x,min,max],i)=>enemies.push({x,y:FLOOR-28,w:32,h:28,vx:i%2?58:-58,vy:0,min,max,alive:true,squash:0}));
    spawn(); hud();
  }
  function spawn() { player={x:80,y:FLOOR-42,w:28,h:42,vx:0,vy:0,grounded:false,invulnerable:1.6,facing:1}; jumpBuffer=0;coyote=0;clearKeys(); }
  function clearKeys() { Object.keys(keys).forEach(k=>keys[k]=false); jumpBuffer=0; }
  function overlay(title,message,label) { ui.title.textContent=title;ui.message.innerHTML=message;ui.play.textContent=label;ui.overlay.hidden=false;hud(); }
  function startGame() { if(state==='ready'||state==='won'||state==='over')reset();state='playing';ui.overlay.hidden=true;hud(); }
  function pause() { if(state==='playing'){state='paused';clearKeys();overlay('歇一歇，再出发。','小径会在这里等你。','继续冒险 →');}else if(state==='paused')startGame(); }
  function burst(x,y,color,count=10) { for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*190,vy:-70-Math.random()*180,life:.55,color}); }
  function reward(x,y) {collected++;score+=100;burst(x,y,'#ffdb78',7);popups.push({x,y,text:'+100',life:.8});hud();}
  function damage(fall=false) {
    if(!fall&&player.invulnerable>0)return;
    lives--;hud();burst(player.x+14,player.y+20,'#f6a087');
    if(lives<=0){state='over';clearKeys();overlay('冒险还没有结束。',`本次收集 ${collected} 枚金币，获得 ${score} 分。<br>再试一次，你会跳得更远。`,'再来一次 →');return;}
    if(fall){spawn();camera=0;}else{player.invulnerable=1.8;player.vx=-player.facing*240;player.vy=-320;}
  }
  function update(dt) {
    time+=dt;player.invulnerable=Math.max(0,player.invulnerable-dt);
    jumpBuffer=Math.max(0,jumpBuffer-dt);coyote=player.grounded?.1:Math.max(0,coyote-dt);
    const dir=Number(keys.right)-Number(keys.left);
    const target=dir*250, acceleration=player.grounded?1900:1200;
    player.vx+=Math.max(-acceleration*dt,Math.min(acceleration*dt,target-player.vx));
    if(dir)player.facing=dir;
    if(jumpBuffer>0&&coyote>0){player.vy=-565;player.grounded=false;coyote=0;jumpBuffer=0;}
    player.vy=Math.min(850,player.vy+1550*dt);
    player.x+=player.vx*dt;
    for(const s of solids)if(overlap(player,s)){player.x=player.vx>0?s.x-player.w:s.x+s.w;player.vx=0;}
    player.x=Math.max(0,Math.min(WORLD-player.w,player.x));
    const oldBottom=player.y+player.h;
    player.y+=player.vy*dt;player.grounded=false;
    for(const s of solids){
      s.bump=Math.max(0,(s.bump||0)-dt);
      if(!overlap(player,s))continue;
      if(player.vy>=0){player.y=s.y-player.h;player.vy=0;player.grounded=true;}
      else {player.y=s.y+s.h;player.vy=0;if(s.type==='question'){s.type='used';s.bump=.18;reward(s.x+20,s.y-18);}else if(s.type==='brick'){s.bump=.15;burst(s.x+20,s.y,'#cf8466',4);}}
    }
    if(player.y>H+90){damage(true);return;}
    for(const c of coins)if(!c.taken&&overlap(player,c)){c.taken=true;reward(c.x+9,c.y+12);}
    for(const e of enemies){
      if(!e.alive){e.squash=Math.max(0,e.squash-dt);continue;}
      e.x+=e.vx*dt;
      if(e.x<e.min||e.x+e.w>e.max){e.x=Math.max(e.min,Math.min(e.max-e.w,e.x));e.vx*=-1;}
      if(overlap(player,e)){
        if(player.vy>0&&oldBottom<=e.y+13){e.alive=false;e.squash=.35;player.y=e.y-player.h;player.vy=-360;score+=200;popups.push({x:e.x,y:e.y,text:'+200',life:.8});burst(e.x+16,e.y,'#b1c091');hud();}
        else damage();
      }
    }
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=600*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);
    for(const p of popups){p.y-=35*dt;p.life-=dt;}popups=popups.filter(p=>p.life>0);
    camera=Math.max(0,Math.min(WORLD-W,player.x-W*.35));
    if(state==='playing'&&player.x+player.w>=flag.x){score+=1000;state='won';clearKeys();burst(flag.x,flag.y,'#ffdf8e',40);overlay('抵达！把日光装进口袋。',`林间原野已通关 · 奖励 1,000 分<br>共收集 ${collected} 枚金币，最终得分 ${score}。`,'再玩一局 →');}
  }
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
  function text(t,x,y,size,color){ctx.fillStyle=color;ctx.font=`bold ${size}px monospace`;ctx.textAlign='center';ctx.fillText(t,x,y);}
  function cloud(x,y,s){rect(x,y,68*s,18*s,'#e4efda');rect(x+12*s,y-12*s,36*s,18*s,'#e4efda');rect(x+25*s,y-20*s,20*s,12*s,'#e4efda');}
  function draw(){
    ctx.fillStyle='#98c9cb';ctx.fillRect(0,0,W,H);
    rect(742-camera*.06,65,62,62,'#f8e3a7');rect(750-camera*.06,57,46,78,'#f8e3a7');
    for(let i=-1;i<7;i++)cloud(i*235-camera*.15,75+(i%3)*30,.9+(i%2)*.3);
    for(let i=-1;i<9;i++){let x=i*280-camera*.24;ctx.fillStyle='#81b4ad';ctx.beginPath();ctx.moveTo(x,456);ctx.lineTo(x+150,200+(i%2)*40);ctx.lineTo(x+330,456);ctx.fill();ctx.fillStyle='#bdd2b9';ctx.beginPath();ctx.moveTo(x+150,200+(i%2)*40);ctx.lineTo(x+115,260+(i%2)*30);ctx.lineTo(x+160,250+(i%2)*30);ctx.fill();}
    for(let i=-1;i<18;i++){let x=i*130-camera*.5;rect(x+22,350,12,106,'#66978f');rect(x,340,60,42,'#70a699');rect(x+8,318,44,28,'#70a699');}
    ctx.save();ctx.translate(-Math.round(camera),0);
    for(const s of solids){const {x,w,h,type}=s;let y=s.y-Math.sin((s.bump||0)/.18*Math.PI)*7;
      if(type==='ground'){rect(x,y,w,h,'#aa7758');rect(x,y,w,12,'#598655');rect(x,y,w,5,'#a5c779');for(let a=x+12;a<x+w;a+=32){rect(a,y+27,12,5,'#bf9068');rect(a+9,y+54,6,6,'#875e49');}for(let a=x+6;a<x+w;a+=20)rect(a,y+11,8,5,'#446d4c');}
      else if(type==='pipe'){rect(x+6,y+12,w-12,h-12,'#3f897c');rect(x+13,y+15,9,h-15,'#71b298');rect(x+w-16,y+15,10,h-15,'#2b655f');rect(x,y,w,20,'#3b756b');rect(x+4,y+3,w-8,7,'#8ac4a5');rect(x,y+18,w,4,'#254f50');}
      else if(type==='platform'){rect(x,y,w,h,'#96694e');rect(x,y,w,7,'#b4cd86');rect(x+6,y+7,w-12,4,'#62895d');}
      else {rect(x,y,w,h,type==='brick'?'#ba775b':type==='question'?'#e5b45f':'#8a8c76');rect(x+3,y+3,w-6,4,type==='question'?'#ffe3a0':'#d29a77');rect(x,y+h-4,w,4,'#805d4b');rect(x+w-4,y,4,h,'#805d4b');if(type==='brick'){rect(x,y+19,w,3,'#805d4b');rect(x+18,y,3,19,'#805d4b');rect(x+8,y+22,3,18,'#805d4b');}else if(type==='question')text('?',x+20,y+29,29,'#fff2ba');else{rect(x+7,y+8,4,4,'#b5b39a');rect(x+28,y+28,4,4,'#666c60');}}
    }
    for(const c of coins)if(!c.taken){let y=c.y+Math.sin(time*4+c.x)*3;let width=12+Math.abs(Math.cos(time*3+c.x))*6;rect(c.x+9-width/2,y,width,24,'#d59a3f');rect(c.x+11-width/2,y+2,width-4,18,'#ffe39b');rect(c.x+8,y+5,3,12,'#fff4c5');}
    rect(flag.x,flag.y,7,flag.h,'#edf1cc');rect(flag.x-4,flag.y-7,15,10,'#ffdd89');rect(flag.x+7,flag.y+9,66,39,'#db7c62');rect(flag.x+49,flag.y+30,24,18,'#98c9cb');text('✦',flag.x+31,flag.y+35,23,'#fff0bc');rect(flag.x-15,FLOOR-9,38,9,'#6e8170');
    // The little trail house beyond the finish line.
    rect(4280,358,90,98,'#e7c893');rect(4270,340,110,20,'#936a58');rect(4282,326,86,14,'#936a58');rect(4313,405,24,51,'#695d50');rect(4292,377,19,20,'#6eaaa4');rect(4343,377,17,20,'#6eaaa4');
    for(const e of enemies)if(e.alive||e.squash>0){let y=e.alive?e.y:e.y+20,h=e.alive?22:7;rect(e.x,y,e.w,h,'#7a676d');rect(e.x+4,y-4,e.w-8,6,'#ac8890');if(e.alive){rect(e.x+5,y+6,7,7,'#fff0d0');rect(e.x+21,y+6,7,7,'#fff0d0');rect(e.x+8,y+8,3,5,'#273e43');rect(e.x+21,y+8,3,5,'#273e43');const step=Math.sin(time*12+e.x)>0?2:0;rect(e.x+2,y+22,10,6-step,'#484957');rect(e.x+20,y+22,10,4+step,'#484957');}}
    if(player&&!(player.invulnerable>0&&Math.floor(time*14)%2)){
      const x=Math.round(player.x),y=Math.round(player.y),step=player.grounded&&Math.abs(player.vx)>20?Math.sin(time*16)*4:0;
      rect(x+3,y+38,10,4,'#283e4d');rect(x+17,y+38,11,4,'#283e4d');rect(x+5,y+28,8,10+step,'#496579');rect(x+17,y+28,8,10-step,'#496579');rect(x+3,y+17,24,15,'#e6a45c');rect(x,y+19,5,14,'#f5cf9b');rect(x+25,y+19,5,13,'#f5cf9b');rect(x+8,y+19,5,11,'#b77849');rect(x+7,y+4,18,15,'#f5cf9b');rect(x+4,y,22,7,'#416f70');rect(x+1,y+6,29,4,'#315759');rect(x+(player.facing>0?21:9),y+11,3,4,'#263d44');rect(x+4,y+18,22,4,'#bc6552');rect(x+4,y+22,6,6,'#bc6552');
    }
    for(const p of particles)rect(p.x,p.y,4,4,p.color);
    for(const p of popups)text(p.text,p.x,p.y,16,'#fff5cd');
    // Signs keep the first encounters readable.
    for(const [x,label] of [[125,'→ 出发'],[970,'注意沟壑'],[4070,'终点 →']]){rect(x+32,416,5,40,'#8b7056');rect(x,389,80,28,'#f0d29a');ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillStyle='#5e6655';ctx.fillText(label,x+40,408);}
    ctx.restore();
  }
  const bindings={ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',' ':'jump',w:'jump',W:'jump',ArrowUp:'jump'};
  function press(key,down){if(down&&!keys[key]&&key==='jump')jumpBuffer=.14;keys[key]=down;if(!down&&key==='jump'&&player&&player.vy< -220)player.vy=-220;}
  const held=new Set();
  window.addEventListener('keydown',e=>{if(e.target instanceof HTMLButtonElement&&e.key===' ')return;if(bindings[e.key]){e.preventDefault();held.add(e.key);if(state==='playing')press(bindings[e.key],true);}if((e.key==='p'||e.key==='P'||e.key==='Escape')&&!e.repeat)pause();});
  window.addEventListener('keyup',e=>{held.delete(e.key);const key=bindings[e.key];if(key&&!Array.from(held).some(k=>bindings[k]===key))press(key,false);});
  window.addEventListener('blur',()=>{held.clear();clearKeys();if(state==='playing')pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();});
  document.querySelectorAll('[data-key]').forEach(button=>{button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);if(state==='playing')press(button.dataset.key,true);});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>press(button.dataset.key,false));});
  ui.play.addEventListener('click',()=>{startGame();ui.play.blur();});ui.pause.addEventListener('click',()=>{pause();ui.pause.blur();});
  document.getElementById('restart').addEventListener('click',e=>{reset();state='playing';ui.overlay.hidden=true;hud();e.target.blur();});
  reset();let last=0,accumulator=0;
  function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;if(state==='playing'){accumulator+=dt;while(accumulator>=1/120){if(state==='playing')update(1/120);accumulator-=1/120;}}else accumulator=0;draw();requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
})();
