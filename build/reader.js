/* Responsive pagination keeps the original paragraphs and annotation anchors intact. */
const R={id:null,page:0,pages:1,stride:0,leaves:2,visible:[],selected:null,mode:'notes',person:null,anchor:null};
let readerResize, folioObserver, paperTurn;

function renderRail(){
  $('#chapter-rail').innerHTML=MV.map(m=>'<div class="rail-group"><button class="rail-label" data-chapter="'+CH[m.from].id+'">'+esc(m.name)+'</button>'+CH.slice(m.from,m.to+1).map(c=>'<button class="chapter-dot" data-chapter="'+c.id+'" title="'+esc(named(c))+'" aria-label="'+esc(named(c))+'"><i aria-hidden="true"></i></button>').join('')+'</div>').join('');
  $('#chapter-rail').querySelectorAll('[data-chapter]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.chapter)));
}
function markRail(id){
  $('#chapter-rail').querySelectorAll('.chapter-dot').forEach(b=>{if(b.dataset.chapter===id)b.setAttribute('aria-current','location');else b.removeAttribute('aria-current')});
  const dot=$('#chapter-rail [aria-current]');
  if(dot){const rail=$('#chapter-rail');rail.scrollLeft=Math.max(0,dot.offsetLeft-rail.offsetLeft-rail.clientWidth/2)}
}

const PERSONS=[...PEOPLE,...(META.references||[])];
const passageSearch={find:$('#chart .find'),hits:$('#hits')};
function personAliases(){
  const aliases=new Map();
  PERSONS.forEach((p,index)=>(p.aliases||[p.name]).forEach(name=>{
    const key=name.toLocaleLowerCase();
    if(!aliases.has(key))aliases.set(key,index);else if(aliases.get(key)!==index)aliases.set(key,null);
  }));
  return aliases;
}
const PERSON_ALIASES=personAliases();
function findPersonMentions(text){
  const names=[...PERSON_ALIASES.keys()].filter(n=>PERSON_ALIASES.get(n)!=null).sort((a,b)=>b.length-a.length);
  if(!names.length)return [];
  const escapeRegex=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pattern=new RegExp('(^|[^\\p{L}\\p{N}_])('+names.map(escapeRegex).join('|')+')(?=$|[^\\p{L}\\p{N}_])','giu');
  const mentions=[];
  for(const m of text.matchAll(pattern)){
    const name=m[2],index=PERSON_ALIASES.get(name.toLocaleLowerCase());
    // Generic cast roles are cues only when printed as speaker labels.
    if(/^(guard|messenger|second messenger|priest|chorus|herdsman|jailer)$/i.test(name)&&name!==name.toUpperCase())continue;
    mentions.push({start:m.index+m[1].length,end:m.index+m[1].length+name.length,index});
  }
  return mentions;
}
function linkPeople(){
  const root=$('#folio-flow'),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
  while(walker.nextNode()){const n=walker.currentNode;if(!n.parentElement.closest('sup'))nodes.push(n)}
  nodes.forEach(node=>{
    const matches=findPersonMentions(node.data);if(!matches.length)return;
    const fragment=document.createDocumentFragment();let cursor=0;
    matches.forEach(m=>{
      fragment.append(document.createTextNode(node.data.slice(cursor,m.start)));
      const button=document.createElement('button');button.className='person-reference';button.dataset.person=m.index;
      button.textContent=node.data.slice(m.start,m.end);button.setAttribute('aria-label','About '+PERSONS[m.index].name);
      fragment.append(button);cursor=m.end;
    });
    fragment.append(document.createTextNode(node.data.slice(cursor)));node.replaceWith(fragment);
  });
  // A name can occur inside a passage note; give each action its own focus target.
  root.querySelectorAll('.ann').forEach(a=>{
    if(!a.querySelector('.person-reference'))return;
    a.removeAttribute('role');a.removeAttribute('aria-label');a.tabIndex=-1;
    const walker=document.createTreeWalker(a,NodeFilter.SHOW_TEXT),texts=[];
    while(walker.nextNode()){const n=walker.currentNode;if(!n.parentElement.closest('.person-reference,sup')&&n.data.trim())texts.push(n)}
    texts.forEach(n=>{const span=document.createElement('span');span.className='annotation-trigger';span.setAttribute('role','button');span.tabIndex=0;span.setAttribute('aria-label','Note '+a.dataset.n);n.replaceWith(span);span.append(n)});
    const sup=a.querySelector('sup');if(sup){sup.setAttribute('role','button');sup.tabIndex=0;sup.setAttribute('aria-label','Note '+a.dataset.n)}
  });
  root.querySelectorAll('[data-person]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();showPerson(+b.dataset.person,b)}));
}
function showPerson(index,target=null){
  if(!PERSONS[index])return;
  const direct=target?.closest('.ann');
  const note=direct?A.notes[direct.dataset.n]:null;
  R.person={index,note};R.mode='person';updateDock();
}
function contextHTML(){
  return '<div class="eyebrow">Reading companion</div><h2>'+esc(META.title)+'</h2><button class="panel-link" data-cover>Introduction →</button>'+
    (PERSONS.length?'<details><summary>People in the work</summary><ul class="resource-people">'+PERSONS.map((p,i)=>'<li><button data-person="'+i+'">'+esc(p.name)+'</button></li>').join('')+'</ul></details>':'')+
    '<details><summary>Find a passage</summary><div data-search-host></div></details><details><summary>This edition</summary><div class="about-copy">'+$('#about').innerHTML+'</div></details><p>Click a speaker or a person’s name for a reminder in Notes. Turn the page with the arrows or a swipe; the dots above jump between sections.</p>';
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
  finishPaperTurn();
  folioObserver?.disconnect();clearTimeout(readerResize);
  R.id=id;R.page=0;R.selected=null;R.mode='notes';R.person=null;R.anchor=null;
  A.notes={};rows.forEach(r=>r.notes.forEach(n=>A.notes[n.n]=n));
  $('#voyage').innerHTML='<div class="reader-layout"><article class="reading" aria-label="'+esc(c.title)+'"><div class="book-surface"><div class="folio-window" id="folio-window"><div class="folio-flow chbody" id="folio-flow">'+rows.map((r,pi)=>'<div class="row"><p data-para="'+pi+'"'+(/\n/.test(r.raw)||id==='extracts'||id==='etymology'?' class="verse"':'')+'>'+r.html+'</p></div>').join('')+'</div></div><button class="page-turn prev" id="turn-prev" aria-label="Previous page">‹</button><button class="page-turn next" id="turn-next" aria-label="Next page">›</button><footer class="folio-footer"><button data-cover>'+esc(META.title)+'</button>'+(D.audio?.[id]?'<button class="listen" data-listen>▶ listen &amp; follow</button>':'')+'<span class="reading-hint">← turn the page →</span><label class="page-count"><span id="page-label"></span> <select id="page-select" aria-label="Go to page"></select></label></footer></div><section class="notes-dock" aria-label="Notes and chapter reading"><div class="dock-toolbar" role="tablist" aria-label="Reading companion"><button role="tab" id="dock-notes" aria-selected="true" aria-controls="dock-content">Notes</button><button role="tab" id="dock-reading" aria-selected="false" aria-controls="dock-content">Chapter reading</button><div class="note-picker" id="note-picker"><span id="note-count"></span><select id="note-select" aria-label="Select a note on this page"></select></div></div><div class="dock-content" id="dock-content" role="tabpanel" tabindex="0"></div></section></article><aside class="resource-panel" id="resource-panel" aria-label="Resources" aria-hidden="true" inert><div class="resource-inner">'+contextHTML()+'</div></aside></div>';
  $('#resource-panel [data-search-host]').append(passageSearch.find,passageSearch.hits);
  $('#turn-prev').addEventListener('click',()=>turnPage(-1));$('#turn-next').addEventListener('click',()=>turnPage(1));
  $('#page-select').addEventListener('change',e=>setPage(+e.target.value));
  $('#note-select').addEventListener('change',e=>selectNote(+e.target.value));
  $('#dock-notes').addEventListener('click',()=>{R.mode='notes';updateDock()});
  $('#dock-reading').addEventListener('click',()=>{R.mode='reading';updateDock()});
  $('#voyage .dock-toolbar').addEventListener('keydown',e=>{if(e.target.matches('[role="tab"]')&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();e.stopPropagation();const next=e.target.id==='dock-notes'?$('#dock-reading'):$('#dock-notes');next.click();next.focus()}});
  linkPeople();
  $('#resource-panel').querySelectorAll('[data-person]').forEach(b=>b.addEventListener('click',()=>{showPerson(+b.dataset.person);setResources(false)}));
  $('#voyage').querySelectorAll('.ann').forEach(a=>{
    const activate=()=>{if(A.notes[a.dataset.n])selectNote(+a.dataset.n)};
    a.addEventListener('click',activate);a.addEventListener('keydown',e=>{if(!e.target.closest('.person-reference')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();activate()}});
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
  if(document.fonts.status!=='loaded')document.fonts.ready.then(()=>{if(R.id===id&&document.body.classList.contains('on-reader'))paginate(R.anchor||anchor,R.anchor?null:pageHint)});
  markRail(id);
  let width=$('#folio-window').clientWidth,height=$('#folio-window').clientHeight;
  folioObserver=new ResizeObserver(()=>{
    const win=$('#folio-window');if(!win||R.id!==id)return;if(win.clientWidth===width&&win.clientHeight===height)return;
    width=win.clientWidth;height=win.clientHeight;
    clearTimeout(readerResize);
    readerResize=setTimeout(()=>{if(R.id===id&&document.body.classList.contains('on-reader'))paginate(R.anchor)},100);
  });
  folioObserver.observe($('#folio-window'));
}

function paginate(anchor=null,hint=null){
  const flow=$('#folio-flow'),win=$('#folio-window');if(!flow||!win.clientWidth||!win.clientHeight)return;
  finishPaperTurn();
  const style=getComputedStyle(flow),line=parseFloat(style.lineHeight);
  flow.style.height=Math.max(line,Math.floor(win.clientHeight/line)*line)+'px';
  R.stride=win.clientWidth+parseFloat(style.columnGap);R.leaves=+style.columnCount;
  flow.style.transform='none';
  R.pages=Math.max(1,Math.ceil((flow.scrollWidth+parseFloat(style.columnGap)-1)/R.stride));
  $('#page-select').innerHTML=Array.from({length:R.pages},(_,i)=>'<option value="'+i+'">'+(i*R.leaves+1)+(R.leaves>1?'–'+(i*R.leaves+R.leaves):'')+'</option>').join('');
  let page=hint==='end'?R.pages-1:typeof hint==='number'?hint:0;
  if(anchor){const p=flow.querySelector('[data-para="'+anchor.pi+'"]');if(p){const range=rangeFor(p,anchor.offset||0,(anchor.offset||0)+1);const rect=range?.getBoundingClientRect()||p.getClientRects()[0];if(rect)page=Math.floor((rect.left-win.getBoundingClientRect().left)/R.stride)}}
  const companion={mode:R.mode,person:R.person,selected:R.selected};
  setPage(page,false);
  R.mode=companion.mode;R.person=companion.person;if(R.visible.includes(companion.selected))R.selected=companion.selected;updateDock();
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
function finishPaperTurn(){
  if(!paperTurn)return;
  const current=paperTurn;paperTurn=null;
  current.animations.forEach(a=>a.cancel());current.layer.remove();
}
function capturePaper(){
  finishPaperTurn();
  if(!window.matchMedia('(prefers-reduced-motion: no-preference)').matches)return null;
  const stage=$('#voyage .book-surface');if(!stage)return null;
  const copy=stage.cloneNode(true),rect=stage.getBoundingClientRect();
  copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
  copy.querySelectorAll('button,select,a,.ann').forEach(el=>el.tabIndex=-1);
  copy.classList.add('paper-copy');copy.style.width=rect.width+'px';copy.style.height=rect.height+'px';
  copy.inert=true;copy.setAttribute('aria-hidden','true');
  return {copy,width:rect.width,height:rect.height,leaves:R.leaves};
}
function flipPaper(outgoing,dir){
  const incoming=capturePaper(),stage=$('#voyage .book-surface');if(!incoming||!stage)return;
  const two=outgoing.leaves===2,w=outgoing.width,leafWidth=two?w/2:w;
  const layer=document.createElement('div');layer.className='paper-turn';layer.inert=true;layer.setAttribute('aria-hidden','true');
  const face=(copy,offset)=>{const host=document.createElement('div');host.className='paper-face';copy.style.left=(-offset)+'px';host.append(copy);return host};
  if(two){const still=face(outgoing.copy.cloneNode(true),dir>0?0:w/2);still.classList.add('paper-still');still.style.width=leafWidth+'px';still.style.left=(dir>0?0:w/2)+'px';layer.append(still)}
  const leaf=document.createElement('div');leaf.className='paper-leaf';leaf.style.width=leafWidth+'px';
  leaf.style.left=(two&&dir>0?w/2:0)+'px';leaf.style.transformOrigin=dir>0?'left center':'right center';
  const front=face(outgoing.copy,two&&dir>0?w/2:0);
  const back=face(incoming.copy,two&&dir<0?w/2:0);back.classList.add('paper-back');
  leaf.append(front,back);layer.append(leaf);stage.append(layer);
  const duration=720;
  const rotation=leaf.animate([{transform:'rotateY(0deg)'},{transform:'rotateY('+(-dir*88)+'deg) skewY('+(-dir*1.2)+'deg)',offset:.5},{transform:'rotateY('+(-dir*180)+'deg)'}],{duration,easing:'cubic-bezier(.32,.05,.2,1)',fill:'forwards'});
  const animations=[rotation];
  const still=layer.querySelector('.paper-still');if(still)animations.push(still.animate([{opacity:1,offset:0},{opacity:1,offset:.85},{opacity:0}],{duration,fill:'forwards'}));
  animations.forEach(a=>a.finished.catch(()=>{}));
  paperTurn={layer,animations};
  rotation.finished.then(()=>{if(paperTurn?.layer===layer){paperTurn=null;layer.remove()}},()=>{});
}

function setPage(page,animate=true){
  const oldPage=R.page;
  const outgoing=animate&&page!==oldPage?capturePaper():null;
  R.page=Math.max(0,Math.min(R.pages-1,page));
  const flow=$('#folio-flow');if(!flow)return;
  flow.getAnimations().forEach(a=>a.cancel());
  flow.style.transition=animate?'':'none';flow.style.transform='translateX('+(-R.page*R.stride)+'px)';
  // Geometry must reflect the destination while notes and saved position are updated.
  flow.style.transition='none';
  $('#page-select').value=String(R.page);$('#page-label').textContent='Page';
  const i=byId[R.id];$('#turn-prev').disabled=R.page===0&&i===0;$('#turn-next').disabled=R.page===R.pages-1&&i===CH.length-1;
  const visible=new Set();
  $('#folio-flow').querySelectorAll('.ann').forEach(a=>{const shown=[...a.getClientRects()].some(visibleRect);a.tabIndex=shown&&a.hasAttribute('role')?0:-1;a.querySelectorAll('.annotation-trigger,sup[role=button]').forEach(t=>t.tabIndex=shown?0:-1);if(shown)visible.add(+a.dataset.n)});
  $('#folio-flow').querySelectorAll('.person-reference').forEach(b=>b.tabIndex=[...b.getClientRects()].some(visibleRect)?0:-1);
  R.person=null;
  R.visible=[...visible];if(!R.visible.includes(R.selected))R.selected=R.visible[0]||null;
  R.mode='notes';updateDock();rememberPage();
  $('#page-select').title='Page '+(R.page*R.leaves+1)+' of '+R.pages*R.leaves+' in this section';
  if(outgoing&&R.page!==oldPage)flipPaper(outgoing,R.page>oldPage?1:-1);
}
function turnPage(dir){
  if(!document.body.classList.contains('on-reader'))return;
  if(R.page+dir>=0&&R.page+dir<R.pages){setPage(R.page+dir);return}
  const next=byId[R.id]+dir;if(CH[next]){const outgoing=capturePaper();go(CH[next].id,true,null,dir<0?'end':0);if(outgoing)flipPaper(outgoing,dir)}
}
function revealPassage(target,offset=0){
  const rect=rangeFor(target,offset,offset+1)?.getBoundingClientRect()||target.getClientRects()[0];if(!rect)return;
  const win=$('#folio-window').getBoundingClientRect();const page=Math.floor((rect.left-win.left+R.page*R.stride)/R.stride);if(page!==R.page)setPage(page);
}
function selectNote(n){if(!A.notes[n])return;R.mode='notes';R.selected=n;updateDock();}
function updateDock(){
  const host=$('#dock-content');if(!host)return;
  $('#dock-notes').setAttribute('aria-selected',R.mode!=='reading');$('#dock-reading').setAttribute('aria-selected',R.mode==='reading');
  host.setAttribute('aria-labelledby',R.mode==='reading'?'dock-reading':'dock-notes');
  $('#note-picker').hidden=R.mode!=='notes';$('#note-count').textContent=R.visible.length+' on this page';
  $('#note-select').innerHTML=R.visible.map(n=>'<option value="'+n+'">Note '+n+'</option>').join('');$('#note-select').hidden=!R.visible.length;$('#note-select').value=String(R.selected);
  $('#folio-flow').querySelectorAll('.ann').forEach(a=>a.classList.toggle('open',R.mode==='notes'&&+a.dataset.n===R.selected));
  const n=A.notes[R.selected];host.innerHTML=R.mode==='reading'?chapterReadingHTML(R.id):n?'<div class="dock-note"><blockquote>'+esc(n.quote.replace(/_/g,''))+'</blockquote><div class="note-prose">'+fmt(n.note)+'</div></div>':'<p class="dock-empty">No notes on this page. Keep reading, or open the chapter reading.</p>';
  $('#folio-flow').querySelectorAll('[data-person]').forEach(b=>b.classList.toggle('active',R.mode==='person'&&+b.dataset.person===R.person?.index));
  if(R.mode==='person'&&R.person){
    const p=PERSONS[R.person.index],note=R.person.note;
    host.innerHTML='<div class="character-note"><button class="notes-back">← Passage notes</button><h3>'+esc(p.name)+'</h3><p class="person-role">'+esc(p.reminder||p.role||'')+'</p>'+(note?'<div class="dock-note"><blockquote>'+esc(note.quote.replace(/_/g,''))+'</blockquote><div class="note-prose">'+fmt(note.note)+'</div></div>':'')+(p.desc||p.why?'<details><summary>More about '+esc(p.name)+'</summary><p>'+esc(p.desc||'')+'</p><p>'+esc(p.why||'')+'</p></details>':'')+'</div>';
    host.querySelector('.notes-back').addEventListener('click',()=>{R.mode='notes';R.person=null;updateDock()});
  }
  host.scrollTop=0;
}
function setResources(open){
  finishPaperTurn();
  const panel=$('#resource-panel'),toggle=$('#resources-toggle');
  panel?.classList.toggle('open',open);
  panel?.closest('.reader-layout').classList.toggle('resources-open',open);
  if(panel){if(!open&&panel.contains(document.activeElement))toggle.focus({preventScroll:true});panel.inert=!open;panel.setAttribute('aria-hidden',String(!open))}
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'Close resources':'Open resources');
  toggle.title=open?'Close resources':'Open resources';
  $('#scrim').classList.toggle('on',open);
}
$('#resources-toggle').addEventListener('click',()=>setResources(!$('#resource-panel')?.classList.contains('open')));
window.addEventListener('resize',()=>{clearTimeout(readerResize);readerResize=setTimeout(()=>{if(document.body.classList.contains('on-reader'))paginate(R.anchor)},150)});
