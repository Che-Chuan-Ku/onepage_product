/* Gomoku P3 — 15x15 board renderer (Canvas) shared by game / opening / replay */

class GomokuBoard{
  constructor(canvas, opts={}){
    this.cv=canvas; this.ctx=canvas.getContext('2d');
    this.N=opts.size||15;                // 15 (一般/火山) 或 16 (沙灘,需求 #40 Q6)
    this.stones={};                      // "r,c" -> 'black'|'white'
    this.lastMove=null;                  // [r,c]
    this.highlight=[];                   // [[r,c],...] win line
    this.opening=new Set();              // "r,c" opening stones (swap2)
    this.interactive=opts.interactive!==false;
    this.onPlace=opts.onPlace||null;
    this.onBlocked=opts.onBlocked||null;  // 點擊障礙物/隱藏格外的非法點時回呼
    this.onHover=opts.onHover||null;      // 滑鼠移動時回呼 [r,c]（大絕預覽用）
    this.onStoneClick=opts.onStoneClick||null; // 點擊已有棋子時回呼 {r,c,color}（精準狙擊用）
    this.cursor=null;                    // [r,c] preview (touch confirm)
    this.requireConfirm=opts.requireConfirm||false;
    this._dpr=window.devicePixelRatio||1;

    // 真劍勝負場地（需求 #34 #39 #40）
    this.field=opts.field||'none';       // 'none' | 'volcano' | 'beach'
    this.obstacles=new Set();            // "r,c" 火山障礙物（雙方可見,開局隨機5-8格,需求 Q5）
    this.beachSide='top';                // 沙灘海洋所在側：top/bottom/left/right
    this.erosion=0;                      // 漲潮已侵蝕排數（Q6：每次漲潮多推進一排）
    this.revealed=[];                    // [{r,c,kind:'eruption'|'tide'}] 已揭露的隱藏格（賽後/回放用,需求 #44 #47）
    this.previewRect=[];                 // 大絕 3寬x2深 預覽框 [[r,c],...]（需求 Q4）
    this.previewLine=[];                 // 橫劈/縱劈 附掛預覽（3格）
    this._fx=[];                         // 暫時特效標記 [{r,c,type,until}]

    this._bind();
    this.resize();
    window.addEventListener('resize',()=>this.resize());
  }
  /* ── 場地設定 API ── */
  setObstacles(list){ this.obstacles=new Set((list||[]).map(([r,c])=>r+','+c)); this.draw(); }
  isObstacle(r,c){ return this.obstacles.has(r+','+c); }
  setBeach(side,erosion){ this.beachSide=side||'top'; this.erosion=erosion||0; this.draw(); }
  isOcean(r,c){
    if(this.field!=='beach') return false;
    const half=Math.floor(this.N/2), e=Math.min(this.erosion,half-1);
    const bound=half+e; // 侵蝕後海洋往沙灘推進的排/列數
    if(this.beachSide==='top')return r<bound;
    if(this.beachSide==='bottom')return r>=this.N-bound;
    if(this.beachSide==='left')return c<bound;
    return c>=this.N-bound; // right
  }
  revealHidden(r,c,kind){ this.revealed.push({r,c,kind}); this._flash(r,c,kind==='eruption'?'burn':'tide'); }
  revealAll(list){ this.revealed=(list||[]).slice(); this.draw(); }
  setPreviewRect(cells){ this.previewRect=cells||[]; this.draw(); }
  setPreviewLine(cells){ this.previewLine=cells||[]; this.draw(); }
  clearPreviews(){ this.previewRect=[]; this.previewLine=[]; this.draw(); }
  _flash(r,c,type){
    this._fx.push({r,c,type,until:Date.now()+1000});
    this.draw();
    const loop=()=>{ this._fx=this._fx.filter(f=>f.until>Date.now()); this.draw(); if(this._fx.length) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  _bind(){
    this.cv.addEventListener('pointerdown',e=>{
      if(!this.interactive)return; // read-only boards (e.g. spectator) ignore all interaction, incl. onStoneClick
      const rc=this._hit(e); if(!rc)return;
      const key=rc.join(',');
      if(this.stones[key] && this.onStoneClick){ this.onStoneClick({r:rc[0],c:rc[1],color:this.stones[key]}); return; }
      if(this.isObstacle(...rc)){ if(this.onBlocked)this.onBlocked(rc,'obstacle'); return; }
      if(this.stones[key]){ if(this.onBlocked)this.onBlocked(rc,'occupied'); return; } // occupied
      if(this.requireConfirm){ this.cursor=rc; this.draw(); }
      else { this._place(rc); }
    });
    this.cv.addEventListener('pointermove',e=>{
      if(!this.onHover)return;
      const rc=this._hit(e); this.onHover(rc);
    });
    // keyboard support
    this.cv.tabIndex=0;
    this.cv.setAttribute('role','grid');
    this.cv.setAttribute('aria-label',this.N+' 乘 '+this.N+' 五子棋盤');
    this._kbCursor=[7,7];
    this.cv.addEventListener('keydown',e=>{
      if(!this.interactive)return;
      const m={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[e.key];
      if(m){e.preventDefault();const mx=this.N-1;this._kbCursor=[Math.max(0,Math.min(mx,this._kbCursor[0]+m[0])),Math.max(0,Math.min(mx,this._kbCursor[1]+m[1]))];this.cursor=this._kbCursor.slice();this.draw();}
      if((e.key==='Enter'||e.key===' ')&&this.cursor){e.preventDefault();this.confirm();}
    });
  }
  _place(rc){
    if(this.onPlace) this.onPlace(rc[0],rc[1]);
  }
  confirm(){ if(this.cursor){const rc=this.cursor;this.cursor=null;this._place(rc);this.draw();} }
  clearCursor(){this.cursor=null;this.draw();}

  set(stones,opts={}){
    this.stones={}; (stones||[]).forEach(s=>this.stones[s.r+','+s.c]=s.color);
    if(opts.opening) opts.opening.forEach(s=>this.opening.add(s.r+','+s.c));
    if('last'in opts) this.lastMove=opts.last;
    if('highlight'in opts) this.highlight=opts.highlight||[];
    this.draw();
  }
  add(r,c,color,isOpening=false){this.stones[r+','+c]=color;this.lastMove=[r,c];if(isOpening)this.opening.add(r+','+c);this.draw();}
  remove(r,c){delete this.stones[r+','+c];this.opening.delete(r+','+c);if(this.lastMove&&this.lastMove[0]===r&&this.lastMove[1]===c)this.lastMove=null;this.draw();}
  setHighlight(line){this.highlight=line||[];this.draw();}

  resize(){
    const size=this.cv.clientWidth;
    this.cv.width=size*this._dpr; this.cv.height=size*this._dpr;
    this.ctx.setTransform(this._dpr,0,0,this._dpr,0,0);
    this.px=size; this.pad=size*0.045; this.gap=(size-2*this.pad)/(this.N-1);
    this.draw();
  }
  _xy(r,c){return [this.pad+c*this.gap, this.pad+r*this.gap];}
  _hit(e){
    const rect=this.cv.getBoundingClientRect();
    const x=e.clientX-rect.left, y=e.clientY-rect.top;
    const c=Math.round((x-this.pad)/this.gap), r=Math.round((y-this.pad)/this.gap);
    if(r<0||r>=this.N||c<0||c>=this.N)return null; return [r,c];
  }
  draw(){
    const ctx=this.ctx, g=this.gap, p=this.pad, S=this.px;
    ctx.clearRect(0,0,S,S);
    // field background (真劍勝負場地,需求 #39 #40) — 畫在格線之下
    if(this.field==='beach'){
      for(let r=0;r<this.N;r++)for(let c=0;c<this.N;c++){
        if(this.isOcean(r,c)){
          const[x,y]=this._xy(r,c);
          ctx.fillStyle='rgba(47,106,138,.55)';
          ctx.fillRect(x-g/2,y-g/2,g,g);
        }
      }
    }
    // grid
    ctx.strokeStyle='#6b4f30'; ctx.lineWidth=1;
    for(let i=0;i<this.N;i++){
      ctx.beginPath();ctx.moveTo(p+i*g,p);ctx.lineTo(p+i*g,S-p);ctx.stroke();
      ctx.beginPath();ctx.moveTo(p,p+i*g);ctx.lineTo(S-p,p+i*g);ctx.stroke();
    }
    // star points
    const stars=this.N===15?[[3,3],[3,11],[11,3],[11,11],[7,7]]:this.N===11?[[2,2],[2,8],[8,2],[8,8],[5,5]]:[[3,3],[3,12],[12,3],[12,12]];
    ctx.fillStyle='#5a3f23';
    stars.forEach(([r,c])=>{const[x,y]=this._xy(r,c);ctx.beginPath();ctx.arc(x,y,g*0.10,0,7);ctx.fill();});
    // volcano obstacles（雙方可見,需求 Q5）
    if(this.field==='volcano'){
      this.obstacles.forEach(k=>{
        const[r,c]=k.split(',').map(Number); const[x,y]=this._xy(r,c);
        ctx.fillStyle='#3a2c22'; ctx.beginPath(); ctx.arc(x,y,g*0.40,0,7); ctx.fill();
        ctx.strokeStyle='#1f1712'; ctx.lineWidth=1.5; ctx.stroke();
        ctx.font=Math.round(g*0.55)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText('🪨',x,y+1);
      });
    }
    // 已揭露的隱藏格（賽後檢視/回放,需求 #44 #47）
    this.revealed.forEach(({r,c,kind})=>{
      const[x,y]=this._xy(r,c);
      ctx.save(); ctx.setLineDash([3,3]); ctx.lineWidth=2;
      ctx.strokeStyle= kind==='eruption'?'#ff7a28':'#5ac8f0';
      ctx.beginPath(); ctx.arc(x,y,g*0.46,0,7); ctx.stroke(); ctx.restore();
      ctx.font=Math.round(g*0.5)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(kind==='eruption'?'🌋':'🌊',x,y+1);
    });
    // 暫時特效（噴發/海浪/漲潮觸發當下,需求 #45）
    this._fx.forEach(({r,c,type})=>{
      const[x,y]=this._xy(r,c);
      ctx.save();
      if(type==='burn'){
        const grad=ctx.createRadialGradient(x,y,0,x,y,g*1.6);
        grad.addColorStop(0,'rgba(255,140,40,.75)'); grad.addColorStop(1,'rgba(255,140,40,0)');
        ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(x,y,g*1.6,0,7); ctx.fill();
        ctx.font=Math.round(g*0.7)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🔥',x,y);
      } else {
        const grad=ctx.createRadialGradient(x,y,0,x,y,g*1.6);
        grad.addColorStop(0,'rgba(80,190,230,.6)'); grad.addColorStop(1,'rgba(80,190,230,0)');
        ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(x,y,g*1.6,0,7); ctx.fill();
        ctx.font=Math.round(g*0.7)+'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🌊',x,y);
      }
      ctx.restore();
    });
    // 大絕 3寬x2深 / 橫劈縱劈 附掛預覽框（需求 Q4 Q10）
    if(this.previewRect.length){
      ctx.save(); ctx.strokeStyle='rgba(255,211,77,.9)'; ctx.lineWidth=2; ctx.setLineDash([5,4]);
      this.previewRect.forEach(([r,c])=>{const[x,y]=this._xy(r,c); ctx.strokeRect(x-g/2+3,y-g/2+3,g-6,g-6);});
      ctx.restore();
    }
    if(this.previewLine.length){
      ctx.save(); ctx.strokeStyle='rgba(78,161,211,.9)'; ctx.lineWidth=2; ctx.setLineDash([5,4]);
      this.previewLine.forEach(([r,c])=>{const[x,y]=this._xy(r,c); ctx.strokeRect(x-g/2+3,y-g/2+3,g-6,g-6);});
      ctx.restore();
    }
    // stones
    const rad=g*0.42;
    for(const k in this.stones){
      const [r,c]=k.split(',').map(Number);const[x,y]=this._xy(r,c);
      const col=this.stones[k];
      const grad=ctx.createRadialGradient(x-rad*.35,y-rad*.4,rad*.1,x,y,rad);
      if(col==='black'){grad.addColorStop(0,'#5a5a62');grad.addColorStop(1,'#0d0d10');}
      else{grad.addColorStop(0,'#ffffff');grad.addColorStop(1,'#cfc8ba');}
      ctx.fillStyle=grad;ctx.beginPath();ctx.arc(x,y,rad,0,7);ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=1;ctx.stroke();
      if(this.opening.has(k)){ // mark opening stones
        ctx.strokeStyle='rgba(224,164,88,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,rad+3,0,7);ctx.stroke();
      }
    }
    // last move marker
    if(this.lastMove){const[x,y]=this._xy(...this.lastMove);ctx.strokeStyle='#e0573e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,rad*0.35,0,7);ctx.stroke();}
    // win highlight
    if(this.highlight.length){
      ctx.save();ctx.shadowColor='#ffd34d';ctx.shadowBlur=18;ctx.strokeStyle='#ffd34d';ctx.lineWidth=3;
      this.highlight.forEach(([r,c])=>{const[x,y]=this._xy(r,c);ctx.beginPath();ctx.arc(x,y,rad+2,0,7);ctx.stroke();});
      if(this.highlight.length>=2){const a=this._xy(...this.highlight[0]),b=this._xy(...this.highlight[this.highlight.length-1]);
        ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();}
      ctx.restore();
    }
    // cursor preview
    if(this.cursor){const[x,y]=this._xy(...this.cursor);
      ctx.strokeStyle='rgba(224,164,88,.95)';ctx.lineWidth=2;ctx.setLineDash([4,4]);
      ctx.beginPath();ctx.arc(x,y,rad,0,7);ctx.stroke();ctx.setLineDash([]);
    }
  }
}
window.GomokuBoard=GomokuBoard;
