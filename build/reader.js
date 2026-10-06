/* Responsive pagination keeps the original paragraphs and annotation anchors intact. */
// Earlier note layouts remain available for comparison.
const requestedNotes=new URLSearchParams(location.search).get('notes');
const NOTE_LAYOUT=['bottom','popover'].includes(requestedNotes)?requestedNotes:'side';
const CHAPTERED_BOOK=CH.some(c=>c.num!=null);
const R={id:null,page:0,pages:1,stride:0,leaves:1,visible:[],selected:null,mode:'notes',person:null,anchor:null};
let readerResize, folioObserver, paperTurn, resourceDrag, resourceFrame, commentState, commentObserver, sideState;
let resourceWidth=null;
try{const saved=JSON.parse(localStorage.getItem('pequod.resourceWidth'));if(Number.isFinite(saved)&&saved>0)resourceWidth=saved}catch(e){}

function renderRail(){
  $('#chapter-rail').innerHTML=MV.map(m=>'<div class="rail-group"><button class="rail-label" data-chapter="'+CH[m.from].id+'">'+esc(m.name)+'</button>'+CH.slice(m.from,m.to+1).map(c=>'<button class="chapter-dot" data-chapter="'+c.id+'" title="'+esc(named(c))+'" aria-label="'+esc(named(c))+'"><i aria-hidden="true"></i></button>').join('')+'</div>').join('');
  $('#chapter-rail').querySelectorAll('[data-chapter]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.chapter,true,null,0)));
}
function markRail(id){
  $('#chapter-rail').querySelectorAll('.chapter-dot').forEach(b=>{if(b.dataset.chapter===id)b.setAttribute('aria-current','location');else b.removeAttribute('aria-current')});
  const dot=$('#chapter-rail [aria-current]');
  if(dot){const rail=$('#chapter-rail');rail.scrollLeft=Math.max(0,dot.offsetLeft-rail.offsetLeft-rail.clientWidth/2)}
}

const PERSONS=[...PEOPLE,...(META.references||[])];
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
  while(walker.nextNode()){const n=walker.currentNode;if(!n.parentElement.closest('sup,.chapter-opening'))nodes.push(n)}
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
  root.querySelectorAll('[data-person]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();showPerson(+b.dataset.person,b,e)}));
}
function showPerson(index,target=null,event=null){
  if(!PERSONS[index])return;
  const direct=target?.closest('.ann');
  const note=direct?A.notes[direct.dataset.n]:null;
  R.person={index,note};R.mode='person';updateDock();
  if(NOTE_LAYOUT==='popover'&&target)openComment({kind:'person',index,note,anchor:target,event});
  if(NOTE_LAYOUT==='side')openSide({kind:'person',index,note,anchor:target,event});
}
function sidePlaceholder(){return '<div class="side-placeholder"><h2>Alongside the page</h2><p>Select a highlighted passage or a character to read about it here.</p></div>'}
function renderSide(){
  const content=$('#side-content');if(!content)return;
  const spec=sideState;
  content.innerHTML=!spec?sidePlaceholder():spec.kind==='essay'?contextHTML(R.id):spec.kind==='person'?characterHTML(PERSONS[spec.index],spec.note,!!spec.note):noteHTML(spec.note);
  content.setAttribute('aria-label',!spec?'Reading companion':spec.kind==='essay'?'Chapter reading':spec.kind==='person'?'About '+PERSONS[spec.index].name:'Note '+spec.note.n);
  content.querySelector('.notes-back')?.addEventListener('click',()=>openSide({kind:'note',note:spec.note,sourceChapter:spec.sourceChapter,anchor:spec.anchor?.closest('.ann')||spec.anchor}));
  $('#resource-panel').scrollTop=0;
}
function clearSide(restoreFocus=false){
  if(!sideState)return;
  const trigger=sideState.trigger;sideState=null;
  trigger?.removeAttribute('aria-expanded');trigger?.removeAttribute('aria-controls');
  R.mode='notes';R.person=null;renderSide();updateDock();
  if(restoreFocus&&trigger?.isConnected)trigger.focus({preventScroll:true});
}
function openSide(spec){
  clearSide();closeComment(false);
  const trigger=spec.event?.target?.closest('button,[role="button"]')||spec.anchor?.closest('button,[role="button"]')||spec.anchor?.querySelector('[role="button"]');
  sideState={...spec,sourceChapter:spec.sourceChapter||R.id,trigger};
  R.mode=spec.kind==='person'?'person':'notes';R.person=spec.kind==='person'?{index:spec.index,note:spec.note}:null;
  if(spec.kind==='note')R.selected=spec.note.n;
  renderSide();setResources(true);updateDock();
  trigger?.setAttribute('aria-expanded','true');trigger?.setAttribute('aria-controls','resource-panel');
  $('#side-content').focus({preventScroll:true});
}
function contextHTML(id){
  return '<section class="chapter-reading" aria-labelledby="chapter-reading-title"><h2 id="chapter-reading-title">Chapter reading</h2><div class="chapter-reading-content">'+chapterReadingHTML(id)+'</div></section>';
}
function chapterReadingHTML(id){
  const cm=CM[id]||{}, out=cm.links||[],inc=D.incoming[id]||[];
  let h=cm.essay?cm.essay.split(/\n\n+/).map(p=>'<p>'+fmt(p)+'</p>').join(''):'<p class="dock-empty">No chapter reading yet.</p>';
  if(out.length||inc.length){
    h+='<section class="threads"><h3>Threads</h3><ul>'+out.map(l=>{const c=CH[byId[l.to]];return c?'<li><a class="xref" href="#'+c.id+'" data-go="'+c.id+'"'+(l.q?' data-q="'+esc(l.q)+'"':'')+'>'+esc(named(c))+'</a><span>'+fmt(l.why||'')+'</span></li>':''}).join('')+'</ul>';
    if(inc.length)h+='<p class="inc">Pointed here from '+inc.map(id=>'<a class="xref" href="#'+id+'" data-go="'+id+'">'+esc(ref(CH[byId[id]])||CH[byId[id]].title)+'</a>').join(', ')+'.</p>';
    h+='</section>';
  }
  return h;
}

function chapterLabel(c){return c.kicker||(c.num!=null?'Chapter '+c.num:c.title)}
function chapterOpening(c){
  if(!CHAPTERED_BOOK)return '';
  const label=chapterLabel(c);
  return '<header class="chapter-opening">'+(label!==c.title?'<div class="chapter-kicker">'+esc(label)+'</div>':'')+'<h2>'+esc(c.title)+'</h2></header>';
}
function renderChapter(id, pageHint=null,companion=null){
  const i=byId[id],c=CH[i],cm=CM[id]||{},m=mvOf(i),rows=wrapAnnotations(c.paras,cm.annotations||[]);
  finishPaperTurn();
  folioObserver?.disconnect();clearTimeout(readerResize);
  R.id=id;R.page=0;R.selected=null;R.mode='notes';R.person=null;R.anchor=null;
  A.notes={};rows.forEach(r=>r.notes.forEach(n=>A.notes[n.n]=n));
  $('#voyage').innerHTML='<div class="reader-layout"><article class="reading" aria-label="'+esc(named(c))+'"><div class="book-surface"><div class="folio-window" id="folio-window"><div class="folio-flow chbody" id="folio-flow">'+chapterOpening(c)+rows.map((r,pi)=>'<div class="row"><p data-para="'+pi+'"'+(/\n/.test(r.raw)||id==='extracts'||id==='etymology'?' class="verse"':'')+'>'+r.html+'</p></div>').join('')+(cm.essay?'<div class="chapter-end"><button class="chapter-essay-link" id="chapter-essay-link" tabindex="-1">Read the chapter essay <span aria-hidden="true">→</span></button></div>':'')+'</div></div><button class="page-turn prev" id="turn-prev" aria-label="Previous page">‹</button><button class="page-turn next" id="turn-next" aria-label="Next page">›</button><footer class="folio-footer"><button data-cover>'+esc(META.title)+'</button>'+(CHAPTERED_BOOK?'<span class="chapter-location">'+esc(chapterLabel(c))+'</span>':'')+(D.audio?.[id]?'<button class="listen" data-listen>▶ listen &amp; follow</button>':'')+'<label class="page-count"><span id="page-label"></span> <select id="page-select" aria-label="Go to page"></select></label></footer></div><section class="notes-dock" aria-label="Notes"><div class="dock-content" id="dock-content" role="region" aria-label="Notes" tabindex="0"></div></section></article><div class="resource-resizer" id="resource-resizer" role="separator" aria-orientation="vertical" aria-label="Resize resources panel" aria-controls="resource-panel" aria-hidden="true" tabindex="-1" title="Drag to resize; double-click to reset"></div><aside class="resource-panel" id="resource-panel" aria-label="Resources" aria-hidden="true" inert><div class="resource-inner side-content" id="side-content" role="region" aria-label="Reading companion" tabindex="-1"></div></aside><svg class="comment-link" id="comment-link" aria-hidden="true" hidden><path/><circle r="2.5"/></svg><aside class="comment-popover" id="comment-popover" role="dialog" aria-modal="false" aria-label="Passage comment" hidden><div class="comment-content" id="comment-content" tabindex="0"></div></aside></div>';
  sideState=companion?.state||null;
  if(sideState?.kind==='person'){R.mode='person';R.person={index:sideState.index,note:sideState.note}}
  renderSide();
  const dock=$('.notes-dock');dock.hidden=NOTE_LAYOUT!=='bottom';dock.inert=dock.hidden;
  $('.reader-layout').classList.toggle('comment-mode',NOTE_LAYOUT!=='bottom');
  setupResourceResize();
  if(sideState)setResources(true);
  $('#turn-prev').addEventListener('click',()=>turnPage(-1));$('#turn-next').addEventListener('click',()=>turnPage(1));
  $('#page-select').addEventListener('change',e=>setPage(+e.target.value));
  $('#chapter-essay-link')?.addEventListener('click',e=>openSide({kind:'essay',anchor:e.currentTarget,event:e}));
  linkPeople();
  $('#voyage').querySelectorAll('.ann').forEach(a=>{
    const activate=e=>{if(A.notes[a.dataset.n])selectNote(+a.dataset.n,a,e)};
    a.addEventListener('click',activate);a.addEventListener('keydown',e=>{if(!e.target.closest('.person-reference')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();activate(e)}});
  });
  $('#voyage').querySelectorAll('button[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
  $('#voyage').querySelectorAll('[data-cover]').forEach(b=>b.addEventListener('click',()=>go('cover')));
  let touch=null;
  $('#folio-window').addEventListener('touchstart',e=>{const t=e.changedTouches[0];touch={x:t.clientX,y:t.clientY}}, {passive:true});
  $('#folio-window').addEventListener('touchend',e=>{if(!touch)return;const t=e.changedTouches[0],dx=t.clientX-touch.x,dy=t.clientY-touch.y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5&&!getSelection()?.toString())turnPage(dx<0?1:-1);touch=null},{passive:true});
  setupAudio(id,rows);
  $('#voyage [data-listen]')?.addEventListener('click',audioPlay);
  const saved=store.get('position',null);
  const anchor=pageHint==null&&saved?.id===id?saved:null;
  paginate(anchor,pageHint);
  if(companion){$('#resource-panel').scrollTop=companion.scrollTop;if(companion.focused)$('#side-content').focus({preventScroll:true})}
  if(document.fonts.status!=='loaded')document.fonts.ready.then(()=>{if(R.id===id&&document.body.classList.contains('on-reader'))paginate(R.anchor||anchor,R.anchor?null:pageHint)});
  markRail(id);
  let width=$('#folio-window').clientWidth,height=$('#folio-window').clientHeight;
  folioObserver=new ResizeObserver(()=>{
    const win=$('#folio-window');if(!win||R.id!==id||resourceDrag)return;if(win.clientWidth===width&&win.clientHeight===height)return;
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
  const duration=540;
  const rotation=leaf.animate([{transform:'rotateY(0deg)'},{transform:'rotateY('+(-dir*88)+'deg) skewY('+(-dir*1.2)+'deg)',offset:.5},{transform:'rotateY('+(-dir*180)+'deg)'}],{duration,easing:'cubic-bezier(.32,.05,.2,1)',fill:'forwards'});
  const animations=[rotation];
  const still=layer.querySelector('.paper-still');if(still)animations.push(still.animate([{opacity:1,offset:0},{opacity:1,offset:.85},{opacity:0}],{duration,fill:'forwards'}));
  animations.forEach(a=>a.finished.catch(()=>{}));
  paperTurn={layer,animations};
  rotation.finished.then(()=>{if(paperTurn?.layer===layer){paperTurn=null;layer.remove()}},()=>{});
}

function setPage(page,animate=true){
  closeComment(false);
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
  const essayLink=$('#chapter-essay-link');if(essayLink)essayLink.tabIndex=[...essayLink.getClientRects()].some(visibleRect)?0:-1;
  R.person=sideState?.kind==='person'?{index:sideState.index,note:sideState.note}:null;
  R.visible=[...visible];if(!R.visible.includes(R.selected))R.selected=R.visible[0]||null;
  R.mode=R.person?'person':'notes';if(sideState?.kind==='note'&&sideState.sourceChapter===R.id)R.selected=sideState.note.n;updateDock();rememberPage();
  $('#page-select').title='Page '+(R.page*R.leaves+1)+' of '+R.pages*R.leaves+' in this section';
  if(outgoing&&R.page!==oldPage)flipPaper(outgoing,R.page>oldPage?1:-1);
}
function turnPage(dir){
  if(!document.body.classList.contains('on-reader'))return;
  if(R.page+dir>=0&&R.page+dir<R.pages){setPage(R.page+dir);return}
  const next=byId[R.id]+dir;
  if(CH[next]){
    const outgoing=capturePaper(),panel=$('#resource-panel');
    const companion=sideState&&sideState.kind!=='essay'?{state:{...sideState},scrollTop:panel.scrollTop,focused:panel.contains(document.activeElement)}:null;
    go(CH[next].id,true,null,dir<0?'end':0,companion);
    if(outgoing)flipPaper(outgoing,dir);
  }
}
function revealPassage(target,offset=0){
  const rect=rangeFor(target,offset,offset+1)?.getBoundingClientRect()||target.getClientRects()[0];if(!rect)return;
  const win=$('#folio-window').getBoundingClientRect();const page=Math.floor((rect.left-win.left+R.page*R.stride)/R.stride);if(page!==R.page)setPage(page);
}
function selectNote(n,anchor=null,event=null){
  if(!A.notes[n])return;
  R.mode='notes';R.person=null;R.selected=n;updateDock();
  if(NOTE_LAYOUT==='popover'){
    anchor=anchor||[...$('#folio-flow').querySelectorAll('.ann[data-n="'+n+'"]')].find(a=>[...a.getClientRects()].some(visibleRect));
    if(anchor)openComment({kind:'note',note:A.notes[n],anchor,event});
  }
  if(NOTE_LAYOUT==='side')openSide({kind:'note',note:A.notes[n],anchor,event});
}
function noteHTML(note){
  const quote=note.quote.replace(/_/g,'').trim(),words=quote.split(/\s+/);
  const excerpt=words.slice(0,8).join(' ')+(words.length>8?'…':'');
  return '<div class="dock-note"><blockquote title="'+esc(quote)+'"><span class="note-number" aria-label="Note '+note.n+'">'+note.n+'</span><span class="note-excerpt">'+esc(excerpt)+'</span></blockquote><div class="note-prose">'+fmt(note.note)+'</div></div>';
}
function characterHTML(person,note,back=true){
  const description=(person.desc||'').split(/\n\n+/).filter(Boolean).map(p=>'<p>'+esc(p)+'</p>').join('');
  return '<div class="character-note">'+(back?'<button class="notes-back">← Passage notes</button>':'')+'<h3>'+esc(person.name)+'</h3><p class="person-role">'+esc(person.reminder||person.role||'')+'</p><div class="person-description">'+description+'</div>'+(note?noteHTML(note):'')+'</div>';
}
function updateDock(){
  const host=$('#dock-content');if(!host)return;
  const active=NOTE_LAYOUT==='bottom'||!!commentState||!!sideState&&sideState.kind!=='essay'&&sideState.sourceChapter===R.id;
  $('#folio-flow').querySelectorAll('.ann').forEach(a=>a.classList.toggle('open',active&&R.mode==='notes'&&+a.dataset.n===R.selected));
  const n=A.notes[R.selected];host.innerHTML=n?noteHTML(n):'<p class="dock-empty">No notes on this page. Keep reading.</p>';
  $('#folio-flow').querySelectorAll('[data-person]').forEach(b=>b.classList.toggle('active',active&&R.mode==='person'&&+b.dataset.person===R.person?.index));
  if(R.mode==='person'&&R.person){
    host.innerHTML=characterHTML(PERSONS[R.person.index],R.person.note);
    host.querySelector('.notes-back').addEventListener('click',()=>{R.mode='notes';R.person=null;updateDock()});
  }
  host.scrollTop=0;
}
function commentAnchorRect(){
  if(!commentState?.anchor.isConnected)return null;
  const win=$('#folio-window').getBoundingClientRect();
  const rects=[...commentState.anchor.getClientRects()].filter(visibleRect).map(r=>({left:Math.max(r.left,win.left),right:Math.min(r.right,win.right),top:Math.max(r.top,win.top),bottom:Math.min(r.bottom,win.bottom)}));
  if(!rects.length)return null;
  const point=commentState.point;
  if(point)rects.sort((a,b)=>{
    const distance=r=>Math.max(r.left-point.x,0,point.x-r.right)**2+Math.max(r.top-point.y,0,point.y-r.bottom)**2;
    return distance(a)-distance(b);
  });
  return rects[0];
}
function placeComment(anchor,size,bounds,gap=32){
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  let left,top,side;
  if(anchor.right+gap+size.width<=bounds.right){left=anchor.right+gap;top=anchor.top-12;side='right'}
  else if(anchor.left-gap-size.width>=bounds.left){left=anchor.left-gap-size.width;top=anchor.top-12;side='left'}
  else {
    left=anchor.left;
    const below=bounds.bottom-anchor.bottom-gap,above=anchor.top-bounds.top-gap;
    side=below>=above?'below':'above';top=side==='below'?anchor.bottom+gap:anchor.top-gap-size.height;
  }
  return {left:clamp(left,bounds.left,bounds.right-size.width),top:clamp(top,bounds.top,bounds.bottom-size.height),side};
}
function positionComment(){
  const popup=$('#comment-popover'),link=$('#comment-link');if(!commentState||!popup||popup.hidden)return;
  const anchor=commentAnchorRect();if(!anchor){closeComment(false);return}
  const bounds={left:12,right:innerWidth-12,top:$('.mast').getBoundingClientRect().bottom+12,bottom:innerHeight-($('#abar').classList.contains('on')?$('#abar').offsetHeight:0)-12};
  const gap=32,width=Math.min(360,bounds.right-bounds.left);
  const beside=anchor.right+gap+width<=bounds.right||anchor.left-gap-width>=bounds.left;
  const room=beside?bounds.bottom-bounds.top:Math.max(bounds.bottom-anchor.bottom-gap,anchor.top-bounds.top-gap);
  const heightLimit=Math.max(60,Math.min(480,room));
  popup.style.width=width+'px';popup.style.setProperty('--comment-max-height',heightLimit+'px');
  const height=Math.min(popup.getBoundingClientRect().height,heightLimit),placed=placeComment(anchor,{width,height},bounds,gap);
  popup.style.left=placed.left+'px';popup.style.top=placed.top+'px';popup.dataset.side=placed.side;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  let sx,sy,ex,ey,path;
  if(placed.side==='left'||placed.side==='right'){
    sx=placed.side==='right'?anchor.right:anchor.left;sy=(anchor.top+anchor.bottom)/2;
    ex=placed.side==='right'?placed.left:placed.left+width;ey=clamp(sy,placed.top+22,placed.top+height-22);
    popup.style.setProperty('--comment-pointer-y',(ey-placed.top)+'px');
    const mid=(sx+ex)/2;path='M '+sx+' '+sy+' C '+mid+' '+sy+' '+mid+' '+ey+' '+ex+' '+ey;
  }else {
    sx=(anchor.left+anchor.right)/2;sy=placed.side==='below'?anchor.bottom:anchor.top;
    ex=clamp(sx,placed.left+22,placed.left+width-22);ey=placed.side==='below'?placed.top:placed.top+height;
    popup.style.setProperty('--comment-pointer-x',(ex-placed.left)+'px');
    const mid=(sy+ey)/2;path='M '+sx+' '+sy+' C '+sx+' '+mid+' '+ex+' '+mid+' '+ex+' '+ey;
  }
  link.setAttribute('viewBox','0 0 '+innerWidth+' '+innerHeight);link.querySelector('path').setAttribute('d',path);
  link.querySelector('circle').setAttribute('cx',sx);link.querySelector('circle').setAttribute('cy',sy);link.removeAttribute('hidden');
}
function openComment(spec){
  closeComment(false);
  const popup=$('#comment-popover'),content=$('#comment-content');if(!popup)return;
  const trigger=spec.event?.target?.closest('button,[role="button"]')||spec.anchor.closest('button,[role="button"]')||spec.anchor.querySelector('[role="button"]');
  const point=spec.event?.detail&&Number.isFinite(spec.event.clientX)?{x:spec.event.clientX,y:spec.event.clientY}:null;
  commentState={...spec,trigger,point};
  if(spec.kind==='person'){R.person={index:spec.index,note:spec.note};R.mode='person'}else{R.selected=spec.note.n;R.person=null;R.mode='notes'}
  content.innerHTML=spec.kind==='person'?characterHTML(PERSONS[spec.index],spec.note,!!spec.note):noteHTML(spec.note);
  popup.setAttribute('aria-label',spec.kind==='person'?'About '+PERSONS[spec.index].name:'Note '+spec.note.n);
  popup.hidden=false;content.scrollTop=0;
  trigger?.setAttribute('aria-expanded','true');trigger?.setAttribute('aria-controls','comment-popover');
  content.querySelector('.notes-back')?.addEventListener('click',()=>selectNote(spec.note.n,spec.anchor.closest('.ann')||spec.anchor));
  updateDock();positionComment();
  if(commentState){content.focus({preventScroll:true});commentObserver=new ResizeObserver(positionComment);commentObserver.observe(popup)}
}
function closeComment(restoreFocus=true){
  if(!commentState)return;
  const trigger=commentState.trigger;commentState=null;commentObserver?.disconnect();
  $('#comment-popover')?.setAttribute('hidden','');$('#comment-link')?.setAttribute('hidden','');
  trigger?.removeAttribute('aria-expanded');trigger?.removeAttribute('aria-controls');
  R.mode='notes';R.person=null;updateDock();
  if(restoreFocus&&trigger?.isConnected)trigger.focus({preventScroll:true});
}
function dismissComment(restoreFocus=true){
  closeComment(restoreFocus);
  if(A.paused){clearTimeout(A.holdTimer);A.paused=false;audioPlay()}
}
document.addEventListener('pointerdown',e=>{if(commentState&&!e.target.closest('.comment-popover')&&!commentState.anchor.contains(e.target))dismissComment(false)});
function resourceBounds(){
  const layout=$('#voyage .reader-layout'),width=layout?.clientWidth||innerWidth;
  const mobile=innerWidth<=760;
  const max=mobile?width*.94:Math.min(width*.55,width-360);
  const min=Math.min(mobile?260:280,Math.max(0,max));
  return {min,max:Math.max(min,max),initial:mobile?Math.min(360,width*.9):Math.max(320,width*.28)};
}
function applyResourceWidth(value=resourceWidth,persist=false){
  const layout=$('#voyage .reader-layout'),handle=$('#resource-resizer');if(!layout||!handle)return;
  const bounds=resourceBounds(),width=Math.round(Math.max(bounds.min,Math.min(bounds.max,value??bounds.initial)));
  layout.style.setProperty('--resource-width',width+'px');
  handle.setAttribute('aria-valuemin',Math.round(bounds.min));handle.setAttribute('aria-valuemax',Math.round(bounds.max));
  handle.setAttribute('aria-valuenow',width);handle.setAttribute('aria-valuetext',width+' pixels wide');
  if(persist){resourceWidth=width;try{localStorage.setItem('pequod.resourceWidth',JSON.stringify(width))}catch(e){}}
  return width;
}
function finishResourceResize(){
  if(!resourceDrag)return;
  const drag=resourceDrag;resourceDrag=null;
  cancelAnimationFrame(resourceFrame);resourceFrame=null;
  applyResourceWidth(drag.width,true);paginate(drag.anchor);
  drag.handle.closest('.reader-layout')?.classList.remove('resizing');document.body.classList.remove('resizing-resources');
  if(drag.handle.hasPointerCapture?.(drag.pointerId))drag.handle.releasePointerCapture(drag.pointerId);
}
function setupResourceResize(){
  const handle=$('#resource-resizer');applyResourceWidth();
  handle.addEventListener('pointerdown',e=>{
    if(e.button!==0||!$('#resource-panel').classList.contains('open'))return;
    e.preventDefault();finishPaperTurn();
    const width=applyResourceWidth();
    resourceDrag={handle,pointerId:e.pointerId,startX:e.clientX,startWidth:width,width,anchor:R.anchor};
    handle.closest('.reader-layout').classList.add('resizing');document.body.classList.add('resizing-resources');
    handle.setPointerCapture(e.pointerId);handle.focus({preventScroll:true});
  });
  handle.addEventListener('pointermove',e=>{
    if(!resourceDrag||e.pointerId!==resourceDrag.pointerId)return;
    resourceDrag.width=resourceDrag.startWidth+resourceDrag.startX-e.clientX;
    if(resourceFrame!=null)return;
    resourceFrame=requestAnimationFrame(()=>{resourceFrame=null;if(resourceDrag){applyResourceWidth(resourceDrag.width);paginate(resourceDrag.anchor)}});
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>handle.addEventListener(type,e=>{if(e.pointerId===resourceDrag?.pointerId)finishResourceResize()}));
  handle.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    e.preventDefault();e.stopPropagation();
    const bounds=resourceBounds(),current=applyResourceWidth(),anchor=R.anchor;
    const width=e.key==='Home'?bounds.min:e.key==='End'?bounds.max:current+(e.key==='ArrowLeft'?1:-1)*(e.shiftKey?80:24);
    const layout=handle.closest('.reader-layout');layout.classList.add('resizing');
    applyResourceWidth(width,true);paginate(anchor);layout.classList.remove('resizing');
  });
  handle.addEventListener('dblclick',()=>{
    const anchor=R.anchor;resourceWidth=null;try{localStorage.removeItem('pequod.resourceWidth')}catch(e){}
    const layout=handle.closest('.reader-layout');layout.classList.add('resizing');
    applyResourceWidth();paginate(anchor);layout.classList.remove('resizing');
  });
}
function setResources(open,resumeAudio=true){
  closeComment(false);finishResourceResize();finishPaperTurn();
  const panel=$('#resource-panel'),toggle=$('#resources-toggle');
  const handle=$('#resource-resizer');if(handle){handle.tabIndex=open?0:-1;handle.setAttribute('aria-hidden',String(!open))}
  panel?.classList.toggle('open',open);
  panel?.closest('.reader-layout').classList.toggle('resources-open',open);
  if(panel){if(!open&&(panel.contains(document.activeElement)||document.activeElement===handle)){const trigger=sideState?.trigger;trigger?.isConnected?trigger.focus({preventScroll:true}):toggle.focus({preventScroll:true})}panel.inert=!open;panel.setAttribute('aria-hidden',String(!open))}
  if(!open){clearSide();if(A.paused&&resumeAudio){clearTimeout(A.holdTimer);A.paused=false;audioPlay()}}
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'Close resources':'Open resources');
  toggle.title=open?'Close resources':'Open resources';
  $('#scrim').classList.toggle('on',open);
}
$('#resources-toggle').addEventListener('click',()=>setResources(!$('#resource-panel')?.classList.contains('open')));
window.addEventListener('resize',()=>{clearTimeout(readerResize);readerResize=setTimeout(()=>{if(document.body.classList.contains('on-reader')){finishResourceResize();applyResourceWidth();paginate(R.anchor)}},150)});
