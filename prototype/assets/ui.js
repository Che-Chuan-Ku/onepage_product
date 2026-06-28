/* Gomoku P3 — shared UI helpers (Toast, Modal, Header) */

function toast(msg, type='info', ttl=3000){
  let host=document.querySelector('.toast-host');
  if(!host){host=document.createElement('div');host.className='toast-host';document.body.appendChild(host);}
  const t=document.createElement('div');
  t.className='toast '+(type==='info'?'':type);
  t.setAttribute('role', type==='error'?'alert':'status');
  t.setAttribute('aria-live', type==='error'?'assertive':'polite');
  t.textContent=msg;
  host.appendChild(t);
  setTimeout(()=>{t.style.transition='opacity .4s';t.style.opacity='0';setTimeout(()=>t.remove(),400);},ttl);
}

function showModal(html){
  const ov=document.createElement('div');ov.className='overlay';
  ov.innerHTML='<div class="modal card pad-lg" role="dialog" aria-modal="true">'+html+'</div>';
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov && ov.dataset.dismiss!=='0')ov.remove();});
  document.addEventListener('keydown',function esc(e){if(e.key==='Escape'&&ov.dataset.dismiss!=='0'){ov.remove();document.removeEventListener('keydown',esc);}});
  return ov;
}
function closeModal(el){(el.closest? el.closest('.overlay'):el)?.remove();}

/* Render shared header with identity state. mode: 'none'|'guest'|'registered' */
function renderHeader(opts={}){
  const id=opts.identity||'registered';
  const name=opts.nickname||'KuPlayer';
  let right='';
  if(id==='none'){
    right=`<a class="btn btn-ghost" href="../user/index.html">註冊 / 登入</a>
           <a class="btn btn-primary" href="../user/index.html#guest">以訪客遊玩</a>`;
  }else if(id==='guest'){
    right=`<span class="badge badge-spec">訪客</span><span>${name}</span>
           <a class="btn btn-ghost" href="../user/index.html">升級為註冊</a>`;
  }else{
    right=`<a class="btn btn-ghost" href="../leaderboard/index.html">戰績 / 排行榜</a>
           <span class="identity"><span class="avatar">${name[0]||'K'}</span>${name}</span>`;
  }
  return `<header class="app-header">
    <a class="logo" href="../home/index.html"><span class="dot"></span>五子棋 Gomoku</a>
    <div class="header-spacer"></div>
    <div class="identity">${right}</div>
  </header>`;
}

/* tiny query helper */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
