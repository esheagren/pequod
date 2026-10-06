// Source-data and page-position regression checks; no browser dependencies.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const template=fs.readFileSync(path.join(__dirname,'template.html'),'utf8');
const reader=fs.readFileSync(path.join(__dirname,'reader.js'),'utf8');
const wrapping=template.slice(template.indexOf('function wrapAnnotations('),template.indexOf('/* ---- chapter view ---- */'));
const remember=reader.slice(reader.indexOf('function rememberPage('),reader.indexOf('function finishPaperTurn('));
const turning=reader.slice(reader.indexOf('function turnPage('),reader.indexOf('function revealPassage('));
const decode=html=>html.replace(/<sup>.*?<\/sup>/g,'').replace(/<[^>]*>/g,'').replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
let chapters=0,paragraphs=0;
for(const file of fs.readdirSync(path.join(root,'books')).filter(f=>f.endsWith('.json'))){
  const book=JSON.parse(fs.readFileSync(path.join(root,'books',file),'utf8'));
  const context={META:book.meta,esc:s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))};
  vm.createContext(context);vm.runInContext(wrapping,context);
  for(const ch of book.chapters){
    const rows=context.wrapAnnotations(ch.paras,book.commentary[ch.id]?.annotations||[]);
    assert.equal(rows.length,ch.paras.length);
    rows.forEach((r,i)=>{assert.equal(decode(r.html).replace(/_/g,''),ch.paras[i].replace(/_/g,''),`${file} ${ch.id} paragraph ${i}`);paragraphs++});
    chapters++;
  }
}

// A 32-character search chunk crosses a column; its first character is on the
// previous page. The saved offset must be the first character actually visible.
let saved;
const p={dataset:{para:'7'},getClientRects:()=>[{visible:true}]};
const context={R:{id:'test'},$:()=>({querySelectorAll:()=>[p]}),textWalk:()=>[[{data:'x'.repeat(100)},0]],
  rangeFor:(_p,start,end)=>({getClientRects:()=>[{visible:start<70&&end>50}]}),
  visibleRect:r=>r.visible,store:{set:(_key,value)=>{saved=value}}};
vm.createContext(context);vm.runInContext(remember,context);context.rememberPage();
assert.equal(saved.offset,50,'save the first visible character, not the start of a crossing chunk');
assert.equal(saved.pi,7);

// Turns within a chapter stay on that chapter; boundary turns land at the
// beginning of the next section and the end of the previous section.
const calls=[];
const turns={capturePaper:()=>null,R:{id:'b',page:1,pages:3},document:{body:{classList:{contains:()=>true}}},byId:{a:0,b:1,c:2},CH:[{id:'a'},{id:'b'},{id:'c'}],setPage:n=>calls.push(['page',n]),go:(id,_push,_q,hint)=>calls.push(['chapter',id,hint])};
vm.createContext(turns);vm.runInContext(turning,turns);
turns.turnPage(1);assert.deepEqual(calls.pop(),['page',2]);
turns.R.page=2;turns.turnPage(1);assert.deepEqual(calls.pop(),['chapter','c',0]);
turns.R.page=0;turns.turnPage(-1);assert.deepEqual(calls.pop(),['chapter','a','end']);
// Name recognition is Unicode-aware, respects word boundaries, and avoids
// ambiguous shared surnames and ordinary uses of generic cast roles.
const recognition=reader.slice(reader.indexOf('function personAliases('),reader.indexOf('function linkPeople('));
let mentions=0;
for(const file of fs.readdirSync(path.join(root,'books')).filter(f=>f.endsWith('.json'))){
  const book=JSON.parse(fs.readFileSync(path.join(root,'books',file),'utf8'));
  const people=[...book.characters,...(book.meta.references||[])];
  const ctx={PERSONS:people};vm.createContext(ctx);vm.runInContext(recognition,ctx);
  for(const ch of book.chapters)for(const para of ch.paras){
    for(const m of ctx.findPersonMentions(para)){
      assert(m.start>=0&&m.end<=para.length&&m.end>m.start);
      assert((people[m.index].aliases||[people[m.index].name]).some(a=>a.toLocaleLowerCase()===para.slice(m.start,m.end).toLocaleLowerCase()));
      mentions++;
    }
  }
  if(book.meta.id==='antigone'){
    const names=ctx.findPersonMentions("ANTIGONE. Ismene and Oedipus, not Antigonean. CHORUS. A guard stands near.");
    assert.deepEqual(Array.from(names,m=>people[m.index].name),['Antigone','Ismene','Oedipus','Chorus of Theban Elders']);
  }
  if(book.meta.id==='crime-and-punishment'){
    const names=ctx.findPersonMentions('Dounia, Sonia, Raskolnikov and Pulcheria Alexandrovna');
    assert.deepEqual(Array.from(names,m=>m.index),[2,5,0,1]);
  }
}
console.log(`PASS: ${mentions} character references matched across all public works.`);
console.log(`PASS: ${chapters} sections, ${paragraphs} paragraphs preserved; saved-offset and chapter-boundary regressions.`);
