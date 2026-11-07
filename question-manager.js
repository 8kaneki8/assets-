/* Ihyaa Question Manager v2 — stable, autosaving editor */
(()=>{
 "use strict";
 const $id=id=>document.getElementById(id);
 const root=()=> $id("categoryEditor");
 const clamp=(n,min,max,fallback)=>Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback;
 let renderToken=0,searchText="",autosaveTimer=null;
 // Cancel any legacy editor render queued during first-load initialization.
 try{if(typeof editorRenderToken==="number")editorRenderToken++}catch(e){}
 const countQuestions=()=>state.categories.reduce((n,c)=>n+(Array.isArray(c.questions)?c.questions.length:0),0);
 const persist=()=>{try{return save()!==false}catch(e){console.error("Question manager save failed",e);toast("تعذر الحفظ على هذا الجهاز");return false}};
 const schedulePersist=()=>{clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{autosaveTimer=null;persist()},450)};
 function toolbar(){
  const host=root()?.parentElement;if(!host||$id("questionManagerToolbar"))return;
  const bar=document.createElement("div");bar.id="questionManagerToolbar";bar.className="qm-toolbar";
  bar.innerHTML='<div class="qm-toolbar-copy"><strong>مكتبة الأسئلة</strong><span id="qmStats">—</span></div><label class="qm-search"><span>⌕</span><input id="qmSearch" type="search" placeholder="ابحث في الفئات والأسئلة والإجابات..." autocomplete="off"></label>';
  host.insertBefore(bar,root());
  $id("qmSearch").addEventListener("input",e=>{searchText=e.target.value.trim().toLocaleLowerCase("ar");applyFilter()});
 }
 function applyFilter(){
  const r=root();if(!r)return;
  r.querySelectorAll(".qm-category").forEach(card=>{
   const term=searchText,match=!term||card.textContent.toLocaleLowerCase("ar").includes(term);
   card.hidden=!match;
   if(term&&match){const list=card.querySelector(".qm-question-list");if(list)list.hidden=false}
  });
 }
 function field(label,control,cls=""){
  const wrap=document.createElement("label");wrap.className="qm-field "+cls;
  const cap=document.createElement("span");cap.textContent=label;wrap.append(cap,control);return wrap;
 }
 function makeInput(type,value,attrs={}){
  const el=document.createElement(type==="textarea"?"textarea":"input");
  if(type!=="textarea")el.type=type;
  el.value=value??"";
  Object.entries(attrs).forEach(([k,v])=>{if(k==="placeholder")el.placeholder=v;else if(k==="min"||k==="max"||k==="step")el[k]=v;else el.setAttribute(k,v)});
  return el;
 }
 function buildEditor(){
  const r=root();if(!r)return;
  const token=++renderToken;r.replaceChildren();toolbar();
  if(!Array.isArray(state.categories))state.categories=[];
  state.categories=state.categories.filter(c=>c&&typeof c==="object").map(c=>({...c,name:String(c.name||"فئة جديدة"),questions:Array.isArray(c.questions)?c.questions.filter(q=>q&&typeof q==="object"):[]}));
  if(!state.categories.length)state.categories.push({name:"فئة جديدة",questions:[]});
  const jobs=[];
  state.categories.forEach((cat,ci)=>{
   const card=document.createElement("section");card.className="qm-category";
   const head=document.createElement("div");head.className="qm-category-head";
   const number=document.createElement("span");number.className="qm-category-number";number.textContent=String(ci+1).padStart(2,"0");
   const name=makeInput("text",cat.name,{placeholder:"اسم الفئة","aria-label":"اسم الفئة","data-cat":String(ci)});
   name.className="qm-category-name";
   const meta=document.createElement("span");meta.className="qm-category-count";meta.textContent=cat.questions.length+" سؤال";
   const collapse=document.createElement("button");collapse.type="button";collapse.className="qm-icon-btn";collapse.textContent="⌄";collapse.title="طي أو توسيع الفئة";
   const del=document.createElement("button");del.type="button";del.className="qm-delete-btn";del.textContent="حذف الفئة";
   del.addEventListener("click",()=>{if(state.categories.length<=1){toast("يجب الاحتفاظ بفئة واحدة على الأقل");return}if(!confirm("حذف فئة "+(cat.name||"هذه الفئة")+" وجميع أسئلتها؟"))return;state.categories.splice(ci,1);persist();buildEditor();refreshQuickQuestionControls()});
   head.append(number,name,meta,collapse,del);card.append(head);
   const list=document.createElement("div");list.className="qm-question-list";
   collapse.addEventListener("click",()=>{list.hidden=!list.hidden;collapse.textContent=list.hidden?"›":"⌄"});
   cat.questions.forEach((q,qi)=>jobs.push(()=>{
    const item=document.createElement("article");item.className="qm-question";
    const top=document.createElement("div");top.className="qm-question-top";
    const label=document.createElement("strong");label.textContent="السؤال "+(qi+1);
    const used=document.createElement("span");used.className="qm-used";used.textContent=q.used?"مستخدم في الجولة":"متاح";
    top.append(label,used);
    const question=makeInput("textarea",q.q,{placeholder:"اكتب نص السؤال بوضوح…","aria-label":"نص السؤال "+(qi+1),"data-q":ci+","+qi,rows:"2"});question.className="qm-question-text";
    const answer=makeInput("text",q.a,{placeholder:"الإجابة الصحيحة","aria-label":"الإجابة الصحيحة "+(qi+1),"data-a":ci+","+qi});
    const points=makeInput("number",q.v??100,{min:"1",max:"10000",step:"1","aria-label":"نقاط السؤال","data-v":ci+","+qi});
    const seconds=makeInput("number",q.time??30,{min:"5",max:"300",step:"1","aria-label":"مدة السؤال بالثواني","data-time":ci+","+qi});
    const grid=document.createElement("div");grid.className="qm-question-meta";
    grid.append(field("النقاط",points),field("الوقت (ثانية)",seconds));
    const bottom=document.createElement("div");bottom.className="qm-question-bottom";
    const remove=document.createElement("button");remove.type="button";remove.className="qm-remove-question";remove.textContent="إزالة السؤال";
    remove.addEventListener("click",()=>{if(!confirm("إزالة السؤال رقم "+(qi+1)+"؟"))return;cat.questions.splice(qi,1);persist();buildEditor();refreshQuickQuestionControls()});
    bottom.append(used,remove);item.append(top,question,field("الإجابة الصحيحة",answer),grid,bottom);list.append(item);
   }));
   const add=document.createElement("button");add.type="button";add.className="qm-add-question";add.textContent="＋ إضافة سؤال إلى هذه الفئة";
   add.addEventListener("click",()=>{cat.questions.push({v:100,q:"",a:"",time:30,used:false});persist();buildEditor();refreshQuickQuestionControls();toast("أضف نص السؤال والإجابة ثم احفظ")});
   card.append(list,add);r.append(card);
  });
  // Avoid repeated Array.shift() reindexing for large saved question banks.
  let jobCursor=0;
  const renderBatch=()=>{
   if(token!==renderToken)return;
   try{
    const stop=Math.min(jobCursor+24,jobs.length);
    while(jobCursor<stop)jobs[jobCursor++]();
    if(jobCursor<jobs.length){setTimeout(renderBatch,0);return}
    const stats=$id("qmStats");if(stats)stats.textContent=state.categories.length+" فئات • "+countQuestions()+" سؤال";
    applyFilter();
   }catch(error){
    const stats=$id("qmStats");if(stats)stats.textContent="تعذر إكمال عرض المكتبة";
    console.error("Question manager batch render failed:",error);
    toast("تعذر عرض بعض الأسئلة. أعد فتح الإدارة أو حدّث الصفحة.");
   }
  };
  renderBatch();
  const addCategory=$id("addCategory");if(addCategory){addCategory.textContent="＋ إنشاء فئة جديدة";addCategory.onclick=()=>{state.categories.push({name:"فئة جديدة",questions:[]});persist();buildEditor();refreshQuickQuestionControls();toast("تم إنشاء الفئة")}}
  r.oninput=e=>{
   const el=e.target;if(!el.dataset)return;
   const [ci,qi]=String(el.dataset.q||el.dataset.a||el.dataset.v||el.dataset.time||"").split(",").map(Number);
   if(el.dataset.cat!==undefined){const c=state.categories[Number(el.dataset.cat)];if(c){c.name=el.value;schedulePersist()}return}
   if(!Number.isInteger(ci)||!Number.isInteger(qi))return;
   const q=state.categories[ci]?.questions[qi];if(!q)return;
   if(el.dataset.q!==undefined)q.q=el.value;
   if(el.dataset.a!==undefined)q.a=el.value;
   if(el.dataset.v!==undefined){const n=Number(el.value);if(Number.isInteger(n)&&n>=1&&n<=10000)q.v=n}
   if(el.dataset.time!==undefined){const n=Number(el.value);if(Number.isInteger(n)&&n>=5&&n<=300)q.time=n}
   schedulePersist();
  };
  r.onchange=e=>{if(e.target?.dataset?.cat!==undefined)refreshQuickQuestionControls()};
 }
 function saveAll(){
  clearTimeout(autosaveTimer);autosaveTimer=null;
  // Read visible controls before validation so the last keystroke is never lost.
  root()?.querySelectorAll("[data-cat]").forEach(el=>{const c=state.categories[Number(el.dataset.cat)];if(c)c.name=el.value});
  root()?.querySelectorAll("[data-q],[data-a],[data-v],[data-time]").forEach(el=>{
   const key=el.dataset.q!==undefined?"q":el.dataset.a!==undefined?"a":el.dataset.v!==undefined?"v":"time";
   const [ci,qi]=String(el.dataset[key]).split(",").map(Number),q=state.categories[ci]?.questions[qi];if(!q)return;
   if(key==="q"||key==="a")q[key]=el.value;
   else {const n=Number(el.value),min=key==="v"?1:5,max=key==="v"?10000:300;if(Number.isInteger(n)&&n>=min&&n<=max)q[key]=n;else el.setCustomValidity("قيمة غير صحيحة");}
  });
  const invalid=[];
  state.categories.forEach((c,ci)=>c.questions.forEach((q,qi)=>{
   q.q=String(q.q||"").trim();q.a=String(q.a||"").trim();
   q.v=clamp(Number(q.v),1,10000,100);q.time=clamp(Number(q.time),5,300,30);
   if(!q.q||!q.a)invalid.push("الفئة "+(ci+1)+" — السؤال "+(qi+1));
  }));
  if(!countQuestions()){toast("أضف سؤالًا واحدًا على الأقل قبل الحفظ");return}
  if(invalid.length){toast("أكمل نص السؤال والإجابة في "+invalid.length+" سؤالًا");const first=root()?.querySelector("[data-q]");first?.focus();return}
  state.categories.forEach(c=>c.name=String(c.name||"فئة جديدة").trim()||"فئة جديدة");
  state.names=[$id("editRed").value.trim()||"الفريق الأحمر",$id("editBlue").value.trim()||"الفريق الأزرق"];
  state.duelTotalMinutes=clamp(Number($id("duelTotalMinutes").value),1,30,7);
  state.theme=$id("themeSelect").value;state.mode=$id("modeSelect").value;
  state.sound=$id("soundToggle").checked;state.events=$id("eventsToggle").checked;
  if(!persist()){toast("لم يتم حفظ التغييرات؛ تحقق من مساحة التخزين");return}
  render();close("hostOverlay");
  if(setupGateActive){localStorage.setItem("ihyaaSetupComplete","1");state.scores=[0,0];state.turn=0;state.current=null;state.winnerShown=false;state.duel={active:false,questions:[],index:0,correct:[0,0]};state.lifelines=[{supervisor:false,double:false,block:false},{supervisor:false,double:false,block:false}];state.pending=[{supervisor:false,double:false,block:false},{supervisor:false,double:false,block:false}];state.categories.forEach(c=>c.questions.forEach(q=>q.used=false));persist();setupGateActive=false;document.body.classList.remove("setup-mode");document.body.classList.add("room-flow-mode");openStartMenu()}
  else{toast("تم حفظ مكتبة الأسئلة والإعدادات بنجاح");if(document.body.classList.contains("room-flow-mode"))openStartMenu()}
 }
 function openManager(){
  const overlay=$id("hostOverlay");if(!overlay)return;
  hideStartMenu();overlay.classList.add("show");
  try{buildEditor();refreshQuickQuestionControls();$id("editRed").value=state.names[0];$id("editBlue").value=state.names[1];$id("themeSelect").value=state.theme||"green";$id("modeSelect").value=state.mode||"classic";$id("soundToggle").checked=state.sound!==false;$id("eventsToggle").checked=state.events!==false;$id("duelTotalMinutes").value=state.duelTotalMinutes||7}
  catch(e){console.error("Question manager open failed",e);toast("تعذر فتح المكتبة. أعد المحاولة")}
 }
 $id("hostOpen").onclick=openManager;
 $id("saveSettings").onclick=saveAll;
 $id("addCategory").onclick=()=>{state.categories.push({name:"فئة جديدة",questions:[]});persist();buildEditor();refreshQuickQuestionControls()};
 $id("quickAddQuestion").onclick=()=>{
  const question=$id("quickQuestionText").value.trim(),answer=$id("quickAnswerText").value.trim();
  const points=Number($id("quickPoints").value),time=Number($id("quickTime").value),newName=$id("quickNewCategory").value.trim();
  if(!question||!answer){toast("اكتب السؤال والإجابة أولًا");return}
  if(!Number.isInteger(points)||points<1||points>10000){toast("النقاط من 1 إلى 10000");return}
  if(!Number.isInteger(time)||time<5||time>300){toast("الوقت من 5 إلى 300 ثانية");return}
  let cat;
  if(newName){cat={name:newName,questions:[]};state.categories.push(cat)}
  else cat=state.categories[Number($id("quickCategory").value)];
  if(!cat){toast("اختر فئة صحيحة أو اكتب فئة جديدة");return}
  cat.questions.push({v:points,q:question,a:answer,time,used:false});
  if(!persist()){cat.questions.pop();return}
  $id("quickQuestionText").value="";$id("quickAnswerText").value="";$id("quickNewCategory").value="";$id("quickPoints").value="100";$id("quickTime").value="30";
  const status=$id("quickQuestionStatus");if(status)status.textContent="تمت الإضافة والحفظ تلقائيًا.";
  render();refreshQuickQuestionControls();buildEditor();toast("تمت إضافة السؤال وحفظه");
 };
 // Replace legacy renderer and reopen the editor if startup opened it before this file loaded.
 window.buildQuestionManager=buildEditor;
 // First-run setup must open only after this manager has replaced the legacy editor.
 if(document.body.classList.contains("setup-mode")){
  const title=$id("hostOverlay")?.querySelector(".modal-head h2");
  if(title)title.textContent="جهّز أسئلة المسابقة";
  openManager();
 }else if($id("hostOverlay")?.classList.contains("show")){
  buildEditor();refreshQuickQuestionControls();
 }
})();
