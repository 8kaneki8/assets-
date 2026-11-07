(()=> {
"use strict";
const URL=window.IHYAA_SUPABASE_URL||"",KEY=window.IHYAA_SUPABASE_ANON_KEY||"";
if(!window.supabase||!URL||!KEY)return;
const db=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
let profile=null,duelId=null,role=null,channel=null,poll=null,clock=null,busy=false,bank=[],editingBankId=null;
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const call=async(name,args={})=>{const r=await db.rpc(name,args);if(r.error)throw r.error;return r.data};
const style=el("style");
style.textContent=`
#ihyaaDuel{position:fixed;inset:0;z-index:13000;background:radial-gradient(circle at 50% 0%,#18243a,#070b13 65%);color:#f6f7fb;display:none;overflow:auto;font-family:Cairo,Tahoma,sans-serif;padding:clamp(12px,3vw,30px)}
#ihyaaDuel.open{display:block}.duel-shell{max-width:1150px;margin:auto}.duel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-bottom:1px solid #ffffff20;padding-bottom:15px}.duel-kicker{color:#d6bd7a;font-size:12px;letter-spacing:2px}.duel-title{font-size:clamp(22px,4vw,34px);font-weight:900;margin:4px 0}.duel-sub{color:#aab5c7;font-size:13px}.duel-actions{display:flex;gap:8px;flex-wrap:wrap}.duel-btn{border:1px solid #ffffff24;border-radius:11px;padding:10px 14px;background:#202b3e;color:white;font:inherit;font-weight:800;cursor:pointer}.duel-btn.gold{background:#c5a45b;color:#151a22}.duel-btn:disabled{opacity:.5;cursor:not-allowed}.duel-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0}.duel-player{padding:18px;border:1px solid #ffffff20;border-radius:18px;background:linear-gradient(145deg,#111b2b,#0c1420);position:relative;overflow:hidden}.duel-player.red{border-top:3px solid #ff5867;box-shadow:inset 0 0 45px #ff33420c}.duel-player.blue{border-top:3px solid #4c9fff;box-shadow:inset 0 0 45px #268cff0c}.duel-player strong{font-size:17px}.duel-score{font-size:34px;font-weight:900}.duel-player.red .duel-score{color:#ff6876}.duel-player.blue .duel-score{color:#69adff}.duel-progress{height:7px;background:#ffffff18;border-radius:20px;overflow:hidden;margin-top:10px}.duel-progress i{display:block;height:100%;background:linear-gradient(90deg,#d9b768,#fff0b7);transition:width .3s}.duel-card{border:1px solid #ffffff20;background:linear-gradient(145deg,#121d2d,#0d1522);border-radius:20px;padding:clamp(16px,3vw,26px);margin:14px 0}.duel-question{font-size:clamp(20px,3vw,29px);font-weight:900;line-height:1.8;margin:12px 0 20px}.duel-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}.duel-option{background:#1d2a3d;border:1px solid #ffffff24;color:#f7f8fc;border-radius:13px;padding:14px;text-align:right;font:inherit;font-weight:700;cursor:pointer;transition:.2s}.duel-option:hover{border-color:#d7b86d;transform:translateY(-2px)}.duel-option:disabled{opacity:.55;cursor:default;transform:none}.duel-muted{color:#aab5c7;font-size:13px;line-height:1.8}.duel-input{width:100%;padding:12px;border-radius:10px;border:1px solid #ffffff30;background:#0b1421;color:white;font:inherit;margin:6px 0 12px}.duel-field{display:grid;gap:5px;margin:10px 0}.duel-field label{font-size:13px;color:#c5cfde;font-weight:800}.duel-list{display:grid;gap:8px}.duel-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:11px;border-radius:11px;background:#ffffff0b;border:1px solid #ffffff16}.duel-status{display:inline-block;padding:5px 10px;border-radius:30px;background:#ffffff16;color:#e5c77f;font-size:12px}.duel-winner{text-align:center;padding:28px;border:1px solid #d9b86b66;background:radial-gradient(circle,#56432155,#111827 70%);border-radius:20px}.duel-winner h2{font-size:clamp(30px,6vw,54px);margin:5px;color:#f2d48b}.duel-error{padding:12px;border-radius:10px;background:#5a2027;color:#ffd7da;margin:10px 0}.duel-fire{position:relative}.duel-fire:before,.duel-fire:after{content:"";position:absolute;bottom:-30px;width:160px;height:180px;filter:blur(38px);opacity:.16;pointer-events:none}.duel-fire:before{left:-40px;background:#ff3d4d}.duel-fire:after{right:-40px;background:#258cff}@media(max-width:650px){.duel-grid{grid-template-columns:1fr}.duel-options{grid-template-columns:1fr}.duel-head{align-items:flex-start}}`;
document.head.append(style);

style.textContent += `
.duel-timer{display:inline-flex;align-items:center;justify-content:center;min-width:130px;padding:9px 18px;margin:0 0 14px;border-radius:999px;border:1px solid #d7b86d66;background:#d7b86d16;color:#f4d99d;font-weight:900;font-size:20px;font-variant-numeric:tabular-nums}
.duel-timer.expired{background:#682b35;color:#ffd8dd;border-color:#ff6575}
.duel-question-progress{margin:0 0 16px}
.duel-question-progress i{background:linear-gradient(90deg,#55a4ff,#e4c47a)}
.duel-winner{position:relative;overflow:hidden}
.duel-winner h2{animation:ihyaaWinnerPop .65s cubic-bezier(.2,.8,.2,1) both}
@keyframes ihyaaWinnerPop{0%{opacity:0;transform:translateY(16px) scale(.8)}100%{opacity:1;transform:translateY(0) scale(1)}}
@media(prefers-reduced-motion:reduce){.duel-winner h2{animation:none}.duel-option:hover{transform:none}}
`;
function updateTimer(){
 const t=$("duelCountdown");if(!t)return;
 if(!t.dataset.deadline){t.textContent="المؤقّت غير متاح";return}
 const remaining=Math.max(0,Math.ceil((Date.parse(t.dataset.deadline)-Date.now())/1000));
 t.textContent=remaining>0?"⏱ "+remaining+" ثانية":"انتهى الوقت";
 t.classList.toggle("expired",remaining===0)
}

const modal=el("div");modal.id="ihyaaDuel";const shell=el("div","duel-shell");modal.append(shell);document.body.append(modal);
function show(title,body){shell.innerHTML="";const head=el("div","duel-head");const left=el("div");left.append(el("div","duel-kicker","مؤسسة إحياء • جيل على خطى السابقين"),el("div","duel-title",title),el("div","duel-sub","نظام المواجهات الرسمي • RED VS BLUE"+(profile?" • "+profile.username+" ("+profile.public_id+")":"")));const actions=el("div","duel-actions");const close=el("button","duel-btn","إغلاق");close.onclick=hide;actions.append(close);head.append(left,actions);shell.append(head,body);modal.classList.add("open")}
function hide(){modal.classList.remove("open");stopSync()}
function stopSync(){if(poll)clearInterval(poll);poll=null;if(clock)clearInterval(clock);clock=null;if(channel){db.removeChannel(channel);channel=null}}
function error(e){let box=$("duelError");if(!box){box=el("div","duel-error");box.id="duelError";shell.append(box)}box.textContent=e?.message||String(e)}
async function ensure(){
 const s=await db.auth.getSession();if(s.error)throw s.error;
 if(!s.data?.session){const a=await db.auth.signInAnonymously();if(a.error){if(/disabled|not enabled|anonymous/i.test(a.error.message||""))throw Error("تسجيل الدخول المجهول غير مفعّل في Supabase. فعّله من Authentication → Sign In / Providers → Anonymous.");throw a.error}}
 const u=await db.auth.getUser();if(u.error)throw u.error;if(!u.data?.user)throw Error("تعذر استعادة جلسة اللاعب. حدّث الصفحة وحاول مرة أخرى.");
 const p=await db.from("ihyaa_profiles").select("username,public_id").eq("user_id",u.data.user.id).maybeSingle();
 if(p.error)throw p.error;if(!p.data)throw Error("لم نجد ملف لاعب لهذا المتصفح. افتح «المسابقات أونلاين» وسجّل اسم اللاعب أولًا.");
 profile={...p.data,user_id:u.data.user.id};return profile
}
function field(parent,label,placeholder="",value=""){const wrap=el("div","duel-field");wrap.append(el("label","",label));const i=el("input","duel-input");i.placeholder=placeholder;i.value=value;wrap.append(i);parent.append(wrap);return i}
function btn(parent,label,fn,cls=""){const b=el("button","duel-btn "+cls,label);b.onclick=async()=>{if(busy)return;busy=true;b.disabled=true;try{await fn()}catch(e){error(e)}finally{busy=false;b.disabled=false}};parent.append(b);return b}
async function loadBank(){bank=await call("ihyaa_duel_bank_list")}
function home(){
 const body=el("div"),cards=el("div","duel-grid");
 const host=el("div","duel-card");
 host.append(el("h3","","إدارة بنك الأسئلة"),el("p","duel-muted","جهّز بنكك الخاص. كل سؤال له أربعة اختيارات وإجابة صحيحة لا تظهر للاعبين."));
 const cat=field(host,"التصنيف","القرآن والتفسير"),question=field(host,"نص السؤال","اكتب السؤال هنا");
 const opts=[];for(let i=0;i<4;i++)opts.push(field(host,"الاختيار "+(i+1),"اكتب الاختيار"));
 const correct=el("select","duel-input");for(let i=0;i<4;i++){const o=el("option","","الإجابة الصحيحة: الاختيار "+(i+1));o.value=String(i);correct.append(o)}host.append(correct);
 const save=btn(host,"حفظ السؤال",async()=>{
  const values=opts.map(x=>x.value.trim());
  if(cat.value.trim().length<2||question.value.trim().length<5||values.some(x=>!x))throw Error("أكمل التصنيف والسؤال والاختيارات الأربعة قبل الحفظ.");
  await call("ihyaa_duel_bank_save",{p_id:editingBankId,p_category:cat.value.trim(),p_question:question.value.trim(),p_options:values,p_correct:Number(correct.value)});
  editingBankId=null;cat.value="";question.value="";opts.forEach(x=>x.value="");correct.value="0";save.textContent="حفظ السؤال";await refreshHome();
 },"gold");
 const bankList=el("div","duel-list");bankList.id="duelBankList";host.append(el("h3","","الأسئلة المحفوظة"),bankList);
 const make=el("div","duel-card");make.append(el("h3","","تجهيز مواجهة جديدة"),el("p","duel-muted","أدخل معرّفَي اللاعبين. اختر 16 سؤالًا: 15 سؤالًا عاديًا وسؤالًا ذهبيًا لحسم التعادل."));
 const red=field(make,"معرّف اللاعب الأحمر","مثال: IH-123456"),blue=field(make,"معرّف اللاعب الأزرق","مثال: IH-654321");
 const selected=el("div","duel-list");selected.id="duelSelected";
 const count=el("p","duel-status","تم اختيار 0 من 16 سؤالًا");count.id="duelSelectedCount";
 make.append(count,selected);
 selected.addEventListener("change",()=>{const n=selected.querySelectorAll("input:checked").length;count.textContent="تم اختيار "+n+" من 16 سؤالًا";});
 btn(make,"إنشاء المواجهة",async()=>{
  const ids=[...selected.querySelectorAll("input:checked")].map(x=>x.value);
  if(!red.value.trim()||!blue.value.trim())throw Error("أدخل معرّفَي اللاعبين.");
  if(red.value.trim().toUpperCase()===blue.value.trim().toUpperCase())throw Error("يجب اختيار لاعبين مختلفين.");
  if(ids.length!==16)throw Error("اختر 16 سؤالًا بالضبط. المختار حاليًا: "+ids.length+".");
  const r=await call("ihyaa_duel_create",{p_red_id:red.value.trim(),p_blue_id:blue.value.trim(),p_question_ids:ids,p_settings:{correct_points:100,last_question_points:200,winner_reward:600,question_seconds:30}});
  duelId=r.duel_id;role="host";await openMatch();
 },"gold");
 const history=el("div","duel-card");history.append(el("h3","","سجل المواجهات"));
 const hist=el("div","duel-list");history.append(hist);
 call("ihyaa_duel_history").then(rows=>{
  if(!rows.length)hist.append(el("p","duel-muted","لا توجد مواجهات سابقة."));
  rows.forEach(r=>{const item=el("div","duel-row");item.append(el("span","",r.red_name+" "+(r.red_score??"—")+" — "+(r.blue_score??"—")+" "+r.blue_name+" • "+r.status));
   btn(item,["lobby","live","paused","golden"].includes(r.status)?"استكمال":"عرض السجل",async()=>{duelId=r.id;role=r.is_host?"host":"player";await openMatch()});hist.append(item)
  })
 }).catch(error);
 const identity=el("div","duel-card");identity.append(el("h3","","معرّف لاعبك"),el("p","duel-muted","احتفظ بهذا المعرّف وشاركه مع الهوست حتى يستطيع إدخالك في مواجهة."));
 const idValue=el("div","duel-status",profile.public_id);identity.append(idValue);
 btn(identity,"نسخ المعرّف",async()=>{await navigator.clipboard.writeText(profile.public_id);idValue.textContent="تم نسخ المعرّف ✓"});
 cards.append(host,make);body.append(identity,cards,history);show("ساحة المواجهات 1 VS 1",body);renderBank();renderSelection()
}
async function renderBank(){
 const target=$("duelBankList");if(!target)return;target.innerHTML="";
 if(!bank.length){target.append(el("p","duel-muted","بنك الأسئلة فارغ. أضف أسئلتك من النموذج أعلاه."));return}
 bank.forEach(q=>{
  const row=el("div","duel-row");row.append(el("span","",q.category+" • "+q.question));
  btn(row,"تعديل",async()=>{
   const fields=[...shell.querySelectorAll(".duel-field input")];
   const cat=fields[0],question=fields[1],opts=fields.slice(2,6),correct=shell.querySelector("select.duel-input");
   if(!cat||!question||opts.length!==4||!correct)throw Error("تعذر فتح محرر السؤال.");
   cat.value=q.category;question.value=q.question;(q.options||[]).forEach((v,i)=>{if(opts[i])opts[i].value=v});correct.value=String(q.correct_option);
   editingBankId=q.id;const save=shell.querySelector(".duel-card .duel-btn.gold");if(save)save.textContent="حفظ التعديلات";
   question.focus();
  });
  btn(row,"حذف",async()=>{if(!confirm("حذف هذا السؤال من بنكك؟"))return;await call("ihyaa_duel_bank_delete",{p_id:q.id});await refreshHome()});target.append(row)
 })
}
function renderSelection(){
 const target=$("duelSelected");if(!target)return;target.innerHTML="";
 bank.forEach(q=>{const row=el("label","duel-row");const cb=el("input");cb.type="checkbox";cb.value=q.id;cb.addEventListener("change",()=>{const n=target.querySelectorAll("input:checked").length;const counter=$("duelSelectedCount");if(counter)counter.textContent="تم اختيار "+n+" من 16 سؤالًا"});row.append(cb,el("span","","["+q.category+"] "+q.question));target.append(row)});
}
async function refreshHome(){await loadBank();renderBank();renderSelection()}
async function openMatch(){stopSync();const body=el("div");body.id="duelMatchBody";show("مواجهة RED VS BLUE",body);await refreshMatch();channel=db.channel("ihyaa-duel-"+duelId).on("postgres_changes",{event:"*",schema:"public",table:"ihyaa_duel_signals",filter:"duel_id=eq."+duelId},()=>refreshMatch().catch(error)).subscribe();poll=setInterval(()=>refreshMatch().catch(()=>{}),1800);clock=setInterval(updateTimer,250)}
async function refreshMatch(){if(!duelId||!$("duelMatchBody"))return;const v=await call("ihyaa_duel_view",{p_duel:duelId});role=v.is_host?"host":"player";const body=$("duelMatchBody");body.innerHTML="";const grid=el("div","duel-grid");for(const [key,label] of [["red","RED • الفريق الأحمر"],["blue","BLUE • الفريق الأزرق"]]){if(role!=="host"&&key!==v.my_team)continue;const p=v[key],card=el("div","duel-player "+key);card.append(el("strong","",label+" — "+p.name),el("div","duel-score",String(p.score)),el("div","duel-muted",p.correct+" صحيحة • "+p.wrong+" خاطئة"),el("div","duel-progress"));const progress=el("i");progress.style.width=Math.min(100,(v.question_no-1)/15*100)+"%";card.lastChild.append(progress);grid.append(card)}body.append(grid);const status=el("div","duel-status",v.status==="live"?"المواجهة جارية":v.status==="paused"?"متوقفة مؤقتًا":v.status==="golden"?"السؤال الذهبي":v.status==="completed"?"انتهت المواجهة":v.status);body.append(status);if(v.status==="completed"){const win=el("div","duel-winner");const winner=v.is_host?(v.winner_id===null?"تعادل":(v.winner_id===v.red_user?v.red.name:v.blue.name)):(v.is_draw?"تعادل":(v.winner_is_me?profile.username:"المنافس"));win.append(el("div","duel-kicker","FINAL RESULT"),el("h2","",winner),el("p","",role==="host"?v.red.name+" "+v.red.score+" — "+v.blue.score+" "+v.blue.name:"تم اعتماد النتيجة من الخادم."),el("p","duel-muted",v.winner_id||v.winner_is_me?"تمت إضافة مكافأة الفوز 600 نقطة إلى النتيجة النهائية.":"انتهت المواجهة بالتعادل؛ لا توجد مكافأة فوز."));body.append(win);return}
const q=v.question;if(q){
 const card=el("div","duel-card duel-fire");
 card.append(el("div","duel-kicker",q.golden?"✨ السؤال الذهبي • 16 / 16":"السؤال "+v.question_no+" / 15"),el("div","duel-question",q.question));
 const timer=el("div","duel-timer","جارٍ حساب الوقت…");timer.id="duelCountdown";timer.dataset.deadline=v.question_deadline||"";card.append(timer);
 const progress=el("div","duel-progress duel-question-progress");const bar=el("i");bar.style.width=Math.min(100,(Number(v.question_no)||1)/16*100)+"%";progress.append(bar);card.append(progress);
 const opts=el("div","duel-options");
 q.options.forEach((o,i)=>{const b=el("button","duel-option",o);b.disabled=!!v.my_answer||role==="host"||v.status==="paused"||!v.question_deadline||Date.parse(v.question_deadline)<=Date.now();b.onclick=async()=>{try{await call("ihyaa_duel_answer",{p_duel:duelId,p_option:i,p_elapsed_ms:null});await refreshMatch()}catch(e){error(e);await refreshMatch()}};opts.append(b)});
 card.append(opts);
 if(v.my_answer)card.append(el("p","duel-status",v.my_answer.correct?"إجابتك صحيحة ✓":"تم تسجيل إجابتك"));
 if(role==="host")card.append(el("p","duel-muted","إجابات اللاعبين: "+(v.host_answers?.length||0)+" / 2"));
 body.append(card);updateTimer()
}else if(v.status==="lobby"){body.append(el("div","duel-card duel-muted","المواجهة جاهزة. اضغط «بدء المواجهة» عندما يكون اللاعبان مستعدين."))}
if(role==="host"){const controls=el("div","duel-card");controls.append(el("h3","","لوحة الهوست"),el("p","duel-muted","حالة كل إجابة تظهر للهوست فقط. اللاعب لا يرى إجابة منافسه أو بياناته الخاصة."));if(v.status==="lobby")btn(controls,"بدء المواجهة",async()=>{await call("ihyaa_duel_start",{p_duel:duelId});await refreshMatch()},"gold");if(v.status==="live"||v.status==="golden")btn(controls,"إيقاف مؤقت",async()=>{await call("ihyaa_duel_control",{p_duel:duelId,p_action:"pause",p_details:{}});await refreshMatch()});if(v.status==="paused")btn(controls,"استئناف",async()=>{await call("ihyaa_duel_control",{p_duel:duelId,p_action:"resume",p_details:{}});await refreshMatch()},"gold");if(v.status==="live"||v.status==="golden"){const answers=v.host_answers?.length||0;const expired=!!v.question_deadline&&Date.parse(v.question_deadline)<=Date.now();const advance=btn(controls,answers===2?"اعتماد الإجابتين والانتقال":"إنهاء الوقت وتجاوز السؤال",async()=>{await call("ihyaa_duel_advance",{p_duel:duelId});await refreshMatch()},"gold");advance.disabled=answers<2&&!expired;}if(v.status!=="completed"&&v.status!=="cancelled")btn(controls,"إنهاء المواجهة",async()=>{if(!confirm("هل تريد إنهاء المواجهة الآن؟"))return;await call("ihyaa_duel_control",{p_duel:duelId,p_action:"finish",p_details:{confirmed:true}});await refreshMatch()});if(v.host_answers?.length){controls.append(el("h4","","سجل إجابات السؤال الحالي"));v.host_answers.forEach(a=>controls.append(el("div","duel-row",a.username+" • "+a.option+" • "+(a.correct?"صحيحة":"خاطئة")+" • "+(a.elapsed_ms||"—")+" ms")))}body.append(controls)}
}
async function launch(){try{await ensure();const rows=await call("ihyaa_duel_history");const active=rows.find(r=>["lobby","live","paused","golden"].includes(r.status));if(active){duelId=active.id;role=active.is_host?"host":"player";await openMatch();return}await loadBank();home()}catch(e){show("تعذر فتح نظام المواجهات",el("p","duel-error",e.message))}}
document.addEventListener("DOMContentLoaded",()=>{const nav=document.querySelector(".nav-actions")||document.querySelector(".nav");if(!nav)return;const b=el("button","duel-btn gold","⚔️ 1 VS 1");b.style.marginInlineStart="8px";b.onclick=launch;nav.append(b)});
})();