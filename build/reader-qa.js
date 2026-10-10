/* Local preview only. Run JSON.stringify(readerQA()) in the browser console. */
window.readerDebug={R,go,setPage,paginate,NOTE_LAYOUT,closeComment,setResources,isScrolling};
window.readerQA=(all=false)=>{
  const errors=[],report=[],start={id:R.id,anchor:R.anchor};
  const html=s=>{const node=document.createElement('div');node.innerHTML=s;return node.innerHTML};
  const assert=(ok,message)=>{if(!ok)errors.push(message)};
  const candidates=all?CH.map(c=>c.id):[...new Set([CH[0].id,CH.at(-1).id,...MV.flatMap(m=>[CH[m.from].id,CH[m.to].id]),CH.reduce((a,c)=>c.paras.join('').length>a.paras.join('').length?c:a).id,...Object.keys(D.audio||{})])];
  go('cover',false);
  assert(!!$('#voyage .work-introduction'),'introduction missing');
  assert(!$('#menu')&&!$('#book-title'),'redundant masthead controls');
  assert(!!$('#brand svg'),'whale logo missing');
  for(const id of candidates){
    go(id,false,null,0);
    const win=$('#folio-window').getBoundingClientRect(),flow=$('#folio-flow');
    const paras=[...flow.querySelectorAll('p')];
    assert(paras.length===CH[byId[id]].paras.length,id+': paragraph count');
    let samples=0,clipped=0,unreachable=0;
    paras.forEach((p,pi)=>{
      const text=textWalk(p).map(([n])=>n.data).join('');
      assert(text.replace(/_/g,'')===CH[byId[id]].paras[pi].replace(/_/g,''),id+': text changed at '+pi);
      for(let offset=0;offset<text.length;offset++){
        if(/\s/.test(text[offset]))continue;
        const range=rangeFor(p,offset,offset+1);
        if(!range)continue;
        for(const rect of range.getClientRects()){
          if(!rect.width||!rect.height)continue;samples++;
          if(isScrolling()){
            const host=$('#folio-window'),top=rect.top-win.top+host.scrollTop;
            if(top < -4||top+rect.height>host.scrollHeight+4)clipped++;
            if(rect.left<win.left-4||rect.right>win.right+4)unreachable++;
          }else{
            if(rect.top<win.top-4||rect.bottom>win.bottom+4)clipped++;
            const page=Math.floor((rect.left-win.left+.5)/R.stride),left=rect.left-win.left-page*R.stride;
            if(page<0||page>=R.pages||left< -4||left+rect.width>win.width+4)unreachable++;
          }
        }
      }
    });
    assert(!clipped,id+': '+clipped+' vertically clipped text samples');
    assert(!unreachable,id+': '+unreachable+' unreachable text samples');
    assert(!$('#voyage .chhead'),'chapter heading remains');
    assert(!!flow.querySelector('.chapter-opening')===CHAPTERED_BOOK,id+': chapter opening');
    if(CHAPTERED_BOOK){assert(visibleRect(flow.querySelector('.chapter-opening').getBoundingClientRect()),id+': chapter opening visible');assert($('.chapter-location').textContent===chapterLabel(CH[byId[id]]),id+': current chapter label')}
    assert(R.leaves===1,id+': single reading page');assert(!$('#resource-panel .chapter-reading-content')&&!!$('#chapter-essay-link'),id+': essay awaits chapter-end link');
    assert($('#resource-panel').inert&&$('#resources-toggle').getAttribute('aria-expanded')==='false','resources must start closed');
    assert($('.notes-dock').hidden===(NOTE_LAYOUT!=='bottom'),id+': inactive notes dock');
    const noteHost=NOTE_LAYOUT==='side'?'#side-content':NOTE_LAYOUT==='popover'?'#comment-content':'#dock-content';
    const person=$('#folio-flow .person-reference');
    if(person){person.click();assert(R.mode==='person'&&!!$(noteHost+' .person-role'),id+': character reminder');assert(!!$(noteHost+' .person-description p')&&!$(noteHost+' details'),id+': description visible without expansion');if(NOTE_LAYOUT==='side')setResources(false);else if(NOTE_LAYOUT==='popover')$('#comment-content').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));else $('#dock-content .notes-back').click();assert(R.mode==='notes',id+': return to notes')}
    const annotatedPerson=$('#folio-flow .ann .person-reference');
    if(annotatedPerson){annotatedPerson.click();assert(R.mode==='person',id+': character inside annotation');annotatedPerson.closest('.ann').querySelector('sup').click();assert(R.mode==='notes',id+': separate passage action')}
    const pageCount=R.pages;
    setPage(pageCount-1,false);
    assert(R.page===pageCount-1,id+': last page unavailable');const essayLink=$('#chapter-essay-link');assert(visibleRect(essayLink.getBoundingClientRect())&&essayLink.tabIndex===0,id+': chapter-end essay reachable');essayLink.click();assert(!!$('#resource-panel .chapter-reading-content'),id+': chapter essay opens on request');setResources(false);setPage(R.pages-1,false);
    if(R.visible.length){const n=R.visible.at(-1);selectNote(n);assert($(noteHost+' .note-number')?.textContent===String(n)&&$(noteHost+' .note-prose')?.innerHTML===html(fmt(A.notes[n].note)),id+': note selection');if(NOTE_LAYOUT==='popover'){assert(!$('#comment-popover').hidden&&!$('#comment-link').hasAttribute('hidden'),id+': attached comment visible');closeComment(false)}else if(NOTE_LAYOUT==='side'){assert($('#resource-panel').classList.contains('open')&&$('#comment-popover').hidden,id+': note in side panel');setResources(false)}}
    const expectedPage=R.pages-1,saved=R.anchor;paginate(saved);assert(R.page===expectedPage,id+': restore expected '+expectedPage+' actual '+R.page+' anchor '+JSON.stringify(saved));
    const i=byId[id];if(i<CH.length-1){turnPage(1);assert(R.id===CH[i+1].id&&R.page===0,id+': next chapter boundary');if(CHAPTERED_BOOK)assert($('.chapter-location').textContent===chapterLabel(CH[i+1]),id+': next chapter label');turnPage(-1);assert(R.id===id&&R.page===R.pages-1,id+': previous chapter boundary')}
    $('#chapter-rail [data-chapter="'+id+'"]').click();assert(R.id===id&&R.page===0,id+': chapter click starts at opening');
    report.push({id,pages:pageCount,samples,clipped,unreachable});
  }
  go(start.id||CH[0].id,false,null,0);if(start.anchor)paginate(start.anchor);
  history.replaceState(null,'','#'+R.id);
  return {book:META.id,viewport:[innerWidth,innerHeight],mode:isScrolling()?'scroll':'pages',sections:report.length,errors,report};
};
