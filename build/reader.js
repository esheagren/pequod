/* Responsive pagination keeps the original paragraphs and annotation anchors intact. */
const R={id:null,page:0,pages:1,stride:0,leaves:2,visible:[],selected:null,mode:'notes',anchor:null};
let readerResize;

function renderRail(){
  $('#chapter-rail').innerHTML=MV.map(m=>'<div class="rail-group"><button class="rail-label" data-chapter="'+CH[m.from].id+'">'+esc(m.name)+'</button>'+CH.slice(m.from,m.to+1).map(c=>'<button class="chapter-dot" data-chapter="'+c.id+'" title="'+esc(named(c))+'" aria-label="'+esc(named(c))+'"><i aria-hidden="true"></i></button>').join('')+'</div>').join('');
  $('#chapter-rail').querySelectorAll('[data-chapter]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.chapter)));
  $('#book-title').textContent=META.title;
  $('#book-title').addEventListener('click',()=>go('cover'));
}
function markRail(id){
  $('#chapter-rail').querySelectorAll('.chapter-dot').forEach(b=>{if(b.dataset.chapter===id)b.setAttribute('aria-current','location');else b.removeAttribute('aria-current')});
  const dot=$('#chapter-rail [aria-current]');
  if(dot){const rail=$('#chapter-rail');rail.scrollLeft=Math.max(0,dot.offsetLeft-rail.offsetLeft-rail.clientWidth/2)}
}

function contextHTML(){
  const ctx=META.context||{};
  const first=p=>(p.first||'').match(/^([a-z0-9]+)/)?.[1];
  const source=s=>s?'<a class="context-source" href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.label)+' ↗</a>':'';
  let h='<div class="eyebrow">Alongside the book</div><h2>'+esc(META.title)+'</h2><p class="byline">'+esc(META.author||'')+' · '+esc(META.year||'')+'</p>';
  if(ctx.world)h+='<details><summary>The world of the work</summary><p>'+esc(ctx.world)+'</p>'+source(ctx.worldSource)+'</details>';
  if(ctx.author)h+='<details><summary>About '+esc(META.author||'the author')+'</summary><p>'+esc(ctx.author)+'</p>'+source(ctx.authorSource)+'</details>';
  if(PEOPLE.length){
    h+='<details open><summary>Characters <span>'+PEOPLE.length+'</span></summary>';
    h+=PEOPLE.map(p=>{const fid=first(p);return '<details class="character"><summary>'+esc(p.name)+'<span class="role">'+esc(p.role)+'</span></summary><p>'+esc(p.desc)+'</p><p>'+esc(p.why||'')+'</p>'+(byId[fid]!=null?'<button class="first-seen" data-go="'+fid+'">First appearance →</button>':'')+'</details>'}).join('');
    h+='</details>';
  }
  h+='<details><summary>This edition &amp; reading guide</summary><div class="about-copy">'+$('#about').innerHTML+'</div><p>Turn pages with the arrows, or swipe across the text. The dots above jump to chapters and sections. Select an underlined passage to read its note below. Your place is remembered in this browser.</p><button class="panel-link" data-cover>Book overview →</button></details>';
  return h;
}
function chapterReadingHTML(id){
  const cm=CM[id]||{}, out=cm.links||[],inc=D.incoming[id]||[];
  let h='<p class="eyebrow">Claude, reading alongside you</p>'+(cm.essay?cm.essay.split(/\n\n+/).map(p=>'<p>'+fmt(p)+'</p>').join(''):'<p class="dock-empty">No chapter reading yet.</p>');
  if(out.length||inc.length){
    h+='<section class="threads"><h3>Threads</h3><ul>'+out.map(l=>{const c=CH[byId[l.to]];return c?'<li><a class="xref" href="#'+c.id+'" data-go="'+c.id+'"'+(l.q?' data-q="'+esc(l.q)+'"':'')+'>'+esc(named(c))+'</a><span>'+fmt(l.why||'')+'</span></li>':''}).join('')+'</ul>';
    if(inc.length)h+='<p class="inc">Pointed here from '+inc.map(id=>'<a class="xref" href="#'+id+'" data-go="'+id+'">'+esc(ref(CH[byId[id]])||CH[byId[id]].title)+'</a>').join(', ')+'.</p>';
    h+='</section>';
  }
  return h;
}

function renderChapter(id, pageHint=null){
  const i=byId[id],c=CH[i],cm=CM[id]||{},m=mvOf(i),rows=wrapAnnotations(c.paras,cm.annotations||[]);
  R.id=id;R.page=0;R.selected=null;R.mode='notes';R.anchor=null;
  A.notes={};rows.forEach(r=>r.notes.forEach(n=>A.notes[n.n]=n));
  $('#voyage').innerHTML='<div class="reader-layout"><article class="reading" aria-label="'+esc(c.title)+'"><div class="book-surface"><header class="chhead"><div><div class="kicker">'+esc(c.kicker||label(c))+' · '+esc(m?.name||'')+'</div><h2>'+esc(c.title)+'</h2></div>'+(D.audio?.[id]?'<button class="listen" data-listen>▶ listen &amp; follow</button>':'')+'</header><div class="folio-window" id="folio-window"><div class="folio-flow chbody" id="folio-flow">'+rows.map((r,pi)=>'<div class="row"><p data-para="'+pi+'"'+(/\n/.test(r.raw)||id==='extracts'||id==='etymology'?' class="verse"':'')+'>'+r.html+'</p></div>').join('')+'</div></div><button class="page-turn prev" id="turn-prev" aria-label="Previous page">‹</button><button class="page-turn next" id="turn-next" aria-label="Next page">›</button><footer class="folio-footer"><button data-cover>'+esc(META.title)+'</button><span class="reading-hint">← turn the page →</span><label class="page-count"><span id="page-label"></span> <select id="page-select" aria-label="Go to page"></select></label></footer></div><section class="notes-dock" aria-label="Notes and chapter reading"><div class="dock-toolbar" role="tablist" aria-label="Reading companion"><button role="tab" id="dock-notes" aria-selected="true" aria-controls="dock-content">Notes</button><button role="tab" id="dock-reading" aria-selected="false" aria-controls="dock-content">Chapter reading</button><div class="note-picker" id="note-picker"><span id="note-count"></span><select id="note-select" aria-label="Select a note on this page"></select></div></div><div class="dock-content" id="dock-content" role="tabpanel" tabindex="0"></div></section></article><aside class="resource-panel" id="resource-panel" aria-label="Resources">'+contextHTML()+'</aside></div>';
  $('#turn-prev').addEventListener('click',()=>turnPage(-1));$('#turn-next').addEventListener('click',()=>turnPage(1));
  $('#page-select').addEventListener('change',e=>setPage(+e.target.value));
  $('#note-select').addEventListener('change',e=>selectNote(+e.target.value));
  $('#dock-notes').addEventListener('click',()=>{R.mode='notes';updateDock()});
  $('#dock-reading').addEventListener('click',()=>{R.mode='reading';updateDock()});
  $('#voyage .dock-toolbar').addEventListener('keydown',e=>{if(e.target.matches('[role="tab"]')&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();e.stopPropagation();const next=e.target.id==='dock-notes'?$('#dock-reading'):$('#dock-notes');next.click();next.focus()}});
  $('#voyage').querySelectorAll('.ann').forEach(a=>{
    const activate=()=>{if(A.notes[a.dataset.n])selectNote(+a.dataset.n)};
    a.addEventListener('click',activate);a.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate()}});
  });
  $('#voyage').querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
  $('#voyage').querySelectorAll('[data-cover]').forEach(b=>b.addEventListener('click',()=>go('cover')));
  let touch=null;
  $('#folio-window').addEventListener('touchstart',e=>{const t=e.changedTouches[0];touch={x:t.clientX,y:t.clientY}}, {passive:true});
  $('#folio-window').addEventListener('touchend',e=>{if(!touch)return;const t=e.changedTouches[0],dx=t.clientX-touch.x,dy=t.clientY-touch.y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5&&!getSelection()?.toString())turnPage(dx<0?1:-1);touch=null},{passive:true});
  setupAudio(id,rows);
  $('#voyage [data-listen]')?.addEventListener('click',audioPlay);
  const saved=store.get('position',null);
  const anchor=pageHint==null&&saved?.id===id?saved:null;
  paginate(anchor,pageHint);
  document.fonts.ready.then(()=>{if(R.id===id&&document.body.classList.contains('on-reader'))paginate(R.anchor||anchor,R.anchor?null:pageHint)});
  markRail(id);
}

function paginate(anchor=null,hint=null){
  const flow=$('#folio-flow'),win=$('#folio-window');if(!flow||!win.clientWidth||!win.clientHeight)return;
  flow.getAnimations().forEach(a=>a.cancel());
  const style=getComputedStyle(flow),line=parseFloat(style.lineHeight);
  flow.style.height=Math.max(line,Math.floor(win.clientHeight/line)*line)+'px';
  R.stride=win.clientWidth+parseFloat(style.columnGap);R.leaves=+style.columnCount;
  flow.style.transform='none';
  R.pages=Math.max(1,Math.ceil((flow.scrollWidth+parseFloat(style.columnGap)-1)/R.stride));
  $('#page-select').innerHTML=Array.from({length:R.pages},(_,i)=>'<option value="'+i+'">'+(i*R.leaves+1)+(R.leaves>1?'–'+(i*R.leaves+R.leaves):'')+'</option>').join('');
  let page=hint==='end'?R.pages-1:typeof hint==='number'?hint:0;
  if(anchor){const p=flow.querySelector('[data-para="'+anchor.pi+'"]');if(p){const range=rangeFor(p,anchor.offset||0,(anchor.offset||0)+1);const rect=range?.getBoundingClientRect()||p.getClientRects()[0];if(rect)page=Math.floor((rect.left-win.getBoundingClientRect().left)/R.stride)}}
  setPage(page,false);
}
function visibleRect(rect){const win=$('#folio-window').getBoundingClientRect();return rect.width>0&&rect.right>win.left+1&&rect.left<win.right-1&&rect.bottom>win.top&&rect.top<win.bottom}
function rememberPage(){
  const ps=[...$('#folio-flow').querySelectorAll('p')];
  for(const p of ps){
    if(![...p.getClientRects()].some(visibleRect))continue;
    const text=textWalk(p).map(([n])=>n.data).join('');
    // A paragraph may span several pages; save a text offset, not a viewport page number.
    for(let offset=0;offset<text.length;offset+=32){
      const range=rangeFor(p,offset,Math.min(text.length,offset+32));
      if(range&&[...range.getClientRects()].some(visibleRect)){
        for(let exact=offset;exact<Math.min(text.length,offset+32);exact++){
          const char=rangeFor(p,exact,exact+1);
          if(char&&[...char.getClientRects()].some(visibleRect)){R.anchor={id:R.id,pi:+p.dataset.para,offset:exact};store.set('position',R.anchor);return}
        }
      }
    }
  }
}
function setPage(page,animate=true){
  R.page=Math.max(0,Math.min(R.pages-1,page));
  const flow=$('#folio-flow');if(!flow)return;
  flow.getAnimations().forEach(a=>a.cancel());
  flow.style.transition=animate?'':'none';flow.style.transform='translateX('+(-R.page*R.stride)+'px)';
  // Geometry must reflect the destination while notes and saved position are updated.
  flow.style.transition='none';
  $('#page-select').value=String(R.page);$('#page-label').textContent='Page';
  const i=byId[R.id];$('#turn-prev').disabled=R.page===0&&i===0;$('#turn-next').disabled=R.page===R.pages-1&&i===CH.length-1;
  const visible=new Set();
  $('#folio-flow').querySelectorAll('.ann').forEach(a=>{const shown=[...a.getClientRects()].some(visibleRect);a.tabIndex=shown?0:-1;if(shown)visible.add(+a.dataset.n)});
  R.visible=[...visible];if(!R.visible.includes(R.selected))R.selected=R.visible[0]||null;
  R.mode='notes';updateDock();rememberPage();
  $('#page-select').title='Page '+(R.page*R.leaves+1)+' of '+R.pages*R.leaves+' in this section';
  if(animate&&window.matchMedia('(prefers-reduced-motion: no-preference)').matches){flow.animate([{opacity:.4},{opacity:1}],{duration:320,easing:'ease-out'});}
}
function turnPage(dir){
  if(!document.body.classList.contains('on-reader'))return;
  if(R.page+dir>=0&&R.page+dir<R.pages){setPage(R.page+dir);return}
  const next=byId[R.id]+dir;if(CH[next])go(CH[next].id,true,null,dir<0?'end':0);
}
function revealPassage(target,offset=0){
  const rect=rangeFor(target,offset,offset+1)?.getBoundingClientRect()||target.getClientRects()[0];if(!rect)return;
  const win=$('#folio-window').getBoundingClientRect();const page=Math.floor((rect.left-win.left+R.page*R.stride)/R.stride);if(page!==R.page)setPage(page);
}
function selectNote(n){if(!A.notes[n])return;R.mode='notes';R.selected=n;updateDock();}
function updateDock(){
  const host=$('#dock-content');if(!host)return;
  $('#dock-notes').setAttribute('aria-selected',R.mode==='notes');$('#dock-reading').setAttribute('aria-selected',R.mode==='reading');
  host.setAttribute('aria-labelledby',R.mode==='notes'?'dock-notes':'dock-reading');
  $('#note-picker').hidden=R.mode!=='notes';$('#note-count').textContent=R.visible.length+' on this page';
  $('#note-select').innerHTML=R.visible.map(n=>'<option value="'+n+'">Note '+n+'</option>').join('');$('#note-select').hidden=!R.visible.length;$('#note-select').value=String(R.selected);
  $('#folio-flow').querySelectorAll('.ann').forEach(a=>a.classList.toggle('open',R.mode==='notes'&&+a.dataset.n===R.selected));
  const n=A.notes[R.selected];host.innerHTML=R.mode==='reading'?chapterReadingHTML(R.id):n?'<div class="dock-note"><blockquote>'+esc(n.quote.replace(/_/g,''))+'</blockquote><div class="note-prose">'+fmt(n.note)+'</div></div>':'<p class="dock-empty">No notes on this page. Keep reading, or open the chapter reading.</p>';
  host.scrollTop=0;
}
function setResources(open){$('#resource-panel')?.classList.toggle('open',open);$('#resources-toggle').setAttribute('aria-expanded',String(open));$('#scrim').classList.toggle('on',open);}
$('#resources-toggle').addEventListener('click',()=>setResources(!$('#resource-panel')?.classList.contains('open')));
window.addEventListener('resize',()=>{clearTimeout(readerResize);readerResize=setTimeout(()=>{if(document.body.classList.contains('on-reader'))paginate(R.anchor)},150)});
