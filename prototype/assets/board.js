/* Gomoku P3 — 15x15 board renderer (Canvas) shared by game / opening / replay */

class GomokuBoard{
  constructor(canvas, opts={}){
    this.cv=canvas; this.ctx=canvas.getContext('2d');
    this.N=15; this.stones={};           // "r,c" -> 'black'|'white'
    this.lastMove=null;                  // [r,c]
    this.highlight=[];                   // [[r,c],...] win line
    this.opening=new Set();              // "r,c" opening stones (swap2)
    this.interactive=opts.interactive!==false;
    this.onPlace=opts.onPlace||null;
    this.cursor=null;                    // [r,c] preview (touch confirm)
    this.requireConfirm=opts.requireConfirm||false;
    this._dpr=window.devicePixelRatio||1;
    this._bind();
    this.resize();
    window.addEventListener('resize',()=>this.resize());
  }
  _bind(){
    this.cv.addEventListener('pointerdown',e=>{
      if(!this.interactive)return;
      const rc=this._hit(e); if(!rc)return;
      if(this.stones[rc.join(',')])return;          // occupied
      if(this.requireConfirm){ this.cursor=rc; this.draw(); }
      else { this._place(rc); }
    });
    // keyboard support
    this.cv.tabIndex=0;
    this.cv.setAttribute('role','grid');
    this.cv.setAttribute('aria-label','15 乘 15 五子棋盤');
    this._kbCursor=[7,7];
    this.cv.addEventListener('keydown',e=>{
      if(!this.interactive)return;
      const m={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[e.key];
      if(m){e.preventDefault();this._kbCursor=[Math.max(0,Math.min(14,this._kbCursor[0]+m[0])),Math.max(0,Math.min(14,this._kbCursor[1]+m[1]))];this.cursor=this._kbCursor.slice();this.draw();}
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
    // grid
    ctx.strokeStyle='#6b4f30'; ctx.lineWidth=1;
    for(let i=0;i<this.N;i++){
      ctx.beginPath();ctx.moveTo(p+i*g,p);ctx.lineTo(p+i*g,S-p);ctx.stroke();
      ctx.beginPath();ctx.moveTo(p,p+i*g);ctx.lineTo(S-p,p+i*g);ctx.stroke();
    }
    // star points
    const stars=[[3,3],[3,11],[11,3],[11,11],[7,7]];
    ctx.fillStyle='#5a3f23';
    stars.forEach(([r,c])=>{const[x,y]=this._xy(r,c);ctx.beginPath();ctx.arc(x,y,g*0.10,0,7);ctx.fill();});
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
