(()=> {
const URL=window.IHYAA_SUPABASE_URL||"", KEY=window.IHYAA_SUPABASE_ANON_KEY||"";
let db=null, room=null, role=null, timer=null, profile=null, busy=false;
const $=id=>document.getElementById(id);
const node=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
const rpc=async(name,args={})=>{const r=await db.rpc(name,args);if(r.error)throw r.error;return r.data};
const ready=()=>window.supabase&&URL.startsWith("https://")&&!URL.includes("YOUR_PROJECT")&&KEY&&!KEY.includes("YOUR_SUPABASE");
const style=node("style");style.textContent=`#ihyaaOnline{position:fixed;inset:0;z-index:10030;background:#071b16d9;display:none;align-items:center;justify-content:center;padding:14px;backdrop-filter:blur(8px)}#ihyaaOnline.open{display:flex}.ihyBox{background:#faf9f4;color:#17352d;width:min(940px,100%);max-height:92vh;overflow:auto;border:1px solid #c6a45b;border-radius:22px;padding:20px}.ihyBox h2{margin:0 0 16px}.ihyGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.ihyCard{background:white;border:1px solid #e5e1d6;border-radius:13px;padding:13px;margin:9px 0}.ihyBox input,.ihyBox select{width:100%;padding:11px;border:1px solid #d7d8cd;border-radius:9px;margin:5px 0 12px}.ihyBtn{border:0;border-radius:10px;padding:10px 14px;margin:4px;background:#0d5946;color:white;font-weight:800;cursor:pointer}.ihyBtn.gold{background:#c6a45b;color:#17352d}.ihyCode{font-size:26px;letter-spacing:3px;font-weight:900;color:#0d5946}.ihyPerson{padding:9px;background:#f2f1e9;border-radius:9px;margin:5px 0}.ihyQuestion{font-size:22px;font-weight:900;padding:16px;background:#f1efe5;border-radius:12px;line-height:1.8}.ihyAnswer{background:#e4f1e8;padding:12px;border-radius:10px;margin:8px 0}.ihyMuted{color:#718078;font-size:13px;line-height:1.8}.ihySection{margin-top:16px;padding-top:12px;border-top:1px solid #e8e3d7}`;
document.head.append(style);

style.textContent+=\`
.ihyAuthLayout{display:grid;gap:14px;max-width:780px;margin:auto}
.ihyAuthPanel{background:linear-gradient(145deg,#fff 0%,#f4f7f5 100%);border:1px solid #d9e3dc;border-radius:18px;padding:20px;box-shadow:0 10px 30px #17352d0d}
.ihyAuthIntro{text-align:center;padding:8px 8px 18px}
.ihyAuthMark{width:48px;height:48px;border-radius:15px;background:#0d5946;color:#f5d98d;display:grid;place-items:center;margin:0 auto 10px;font-size:25px;font-weight:900}
.ihyAuthLabel{display:block;font-weight:800;margin:8px 0}
.ihyAuthInput{display:block;box-sizing:border-box;width:100%;padding:13px 14px;border:1px solid #cbd8d0;border-radius:11px;background:#fff;color:#17352d;font:inherit;outline:none}
.ihyAuthInput:focus,.ihyBox input:focus{border-color:#0d8062;box-shadow:0 0 0 3px #0d80621c}
.ihyAuthSubmit{width:100%;padding:13px;margin:12px 0 0}
.ihyIdentity{display:grid;gap:8px;text-align:center;padding:14px;background:#edf4ef;border:1px solid #d4e4d8;border-radius:14px}
.ihyIdentityLabel{font-size:12px;color:#64776c}
.ihyIdentityName{font-size:22px}
.ihyPlayerId{font-size:13px;letter-spacing:1px;color:#0d5946;font-weight:800;direction:ltr}
.ihyEditBtn{background:#e8eee9;color:#24483b}
.ihyEditWrap{display:grid;gap:8px;margin-top:8px}
.ihyAuthError{background:#fff0ed;border:1px solid #efc1b8;color:#922f20;padding:11px;border-radius:10px;line-height:1.7}
.ihyBtn:disabled{opacity:.55;cursor:not-allowed}
\`;

const modal=node("div");modal.id="ihyaaOnline";const box=node("div","ihyBox");modal.append(box);document.body.append(modal);
const close=()=>{if(document.body.classList.contains("room-flow-mode"))return;modal.classList.remove("open");if(timer)clearInterval(timer);timer=null};
const shell=(title,content)=>{box.innerHTML="";const h=node("h2","",title);box.append(h,content);const x=node("button","ihyBtn","إغلاق");x.onclick=close;box.insertBefore(x,h);modal.classList.add("open")};
const field=(parent,label,placeholder,type)=>{parent.append(node("label","",label));const i=node("input");i.placeholder=placeholder||"";i.type=type||"text";parent.append(i);return i};
const button=(parent,label,fn,cls)=>{const b=node("button","ihyBtn "+(cls||""),label);b.onclick=async()=>{if(busy)return;busy=true;b.disabled=true;try{await fn()}catch(e){fail(e)}finally{busy=false;b.disabled=false}};parent.append(b);return b};
const fail=e=>{
 const raw=String(e?.message||e||"حدث خطأ غير متوقع");
 const msg=raw.includes("Invalid login")?"تعذر تسجيل الدخول. حدّث الصفحة وحاول مرة أخرى."
  :raw.includes("اسم المستخدم")?raw
  :raw.includes("Failed to fetch")||raw.includes("NetworkError")?"تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مجددًا."
  :raw.includes("User already registered")?"هذا الحساب موجود بالفعل."
  :raw;
 const old=$("ihyAuthError");if(old)old.remove();
 const target=$("ihyAuthPanel")||box;
 const error=node("p","ihyAuthError",msg);error.setAttribute("role","alert");target.prepend(error);
};
async function auth(){
 if(!ready())throw Error("إعداد الاتصال غير مكتمل. تحقق من تحميل مكتبة Supabase وملف الإعدادات.");
 if(!db)db=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 const current=await db.auth.getSession();if(current.error)throw current.error;
 if(!current.data.session){const signed=await db.auth.signInAnonymously();if(signed.error)throw signed.error;}
 const user=await db.auth.getUser();if(user.error)throw user.error;
 if(!user.data.user)throw Error("تعذر إنشاء جلسة لاعب. حاول مرة أخرى.");
 return true;
}
async function restoreProfile(){
 if(!db)return null;
 const user=await db.auth.getUser();if(user.error)throw user.error;
 if(!user.data.user){profile=null;return null;}
 const r=await db.from("ihyaa_profiles").select("username,public_id").eq("user_id",user.data.user.id).maybeSingle();
 if(r.error)throw r.error;
 profile=r.data?{username:r.data.username,player_id:r.data.public_id}:null;return profile;
}
async function login(name){
 const clean=String(name||"").normalize("NFKC").trim().replace(/\s+/g," ");
 if(clean.length<2||clean.length>24)throw Error("اسم اللاعب يجب أن يكون من حرفين إلى 24 حرفًا.");
 if(!/^[\p{L}\p{N} _.-]+$/u.test(clean))throw Error("استخدم الحروف والأرقام والمسافة أو الرموز البسيطة فقط.");
 await auth();
 profile=await rpc("ihyaa_register",{p_username:clean});
 profile={username:profile.username,player_id:profile.player_id};
 home();
}
function home(){
 const c=node("div","ihyAuthLayout");
 const top=node("div","ihyAuthPanel");top.id="ihyAuthPanel";
 const intro=node("div","ihyAuthIntro");
 intro.append(node("div","ihyAuthMark","إ"),node("div","", "جيل على خطى السابقين"),node("p","ihyMuted","ملف لاعب واحد يحفظ اسمك ومعرّفك على هذا المتصفح."));
 top.append(intro);
 if(!profile){
  const label=node("label","ihyAuthLabel","اسم اللاعب");
  const name=node("input","ihyAuthInput");name.id="ihyPlayerName";name.type="text";name.placeholder="اكتب الاسم الذي سيظهر للمشاركين";name.maxLength=24;name.autocomplete="nickname";name.minLength=2;
  const hint=node("p","ihyMuted","من حرفين إلى 24 حرفًا. سيُحفظ الاسم تلقائيًا لهذا المتصفح.");
  const submit=node("button","ihyBtn gold ihyAuthSubmit","إنشاء ملف اللاعب والمتابعة");
  submit.onclick=async()=>{if(busy)return;busy=true;submit.disabled=true;submit.textContent="جارٍ تجهيز ملفك…";try{await login(name.value)}catch(e){fail(e)}finally{busy=false;submit.disabled=false;submit.textContent="إنشاء ملف اللاعب والمتابعة"}};
  name.addEventListener("keydown",e=>{if(e.key==="Enter")submit.click()});
  top.append(label,name,hint,submit);
 }else{
  const identity=node("div","ihyIdentity");
  identity.append(node("div","ihyIdentityLabel","تم تسجيل دخولك بهذا المتصفح"),node("strong","ihyIdentityName",profile.username),node("div","ihyPlayerId","معرّف اللاعب: "+profile.player_id));
  const edit=node("button","ihyBtn ihyEditBtn","تعديل الاسم");
  edit.onclick=()=>{const wrap=node("div","ihyEditWrap");const input=node("input","ihyAuthInput");input.value=profile.username;input.maxLength=24;input.autocomplete="nickname";const save=node("button","ihyBtn gold","حفظ الاسم");const cancel=node("button","ihyBtn ihyEditBtn","إلغاء");save.onclick=async()=>{if(busy)return;busy=true;save.disabled=true;try{await login(input.value)}catch(e){fail(e)}finally{busy=false;save.disabled=false}};cancel.onclick=()=>wrap.remove();wrap.append(input,save,cancel);identity.append(wrap);input.focus();};
  identity.append(edit);top.append(identity);
 }
 const grid=node("div","ihyGrid");
 const host=node("div","ihyCard");host.append(node("h3","","استضافة مسابقة"),node("p","ihyMuted","أنشئ غرفة وشارك كودها مع اللاعبين."));
 const title=field(host,"اسم المسابقة","مثال: تحدي التفسير");
 const pass=field(host,"كلمة مرور اختيارية","اتركها فارغة إذا لم تحتجها","password");
 button(host,"إنشاء غرفة",async()=>{
  await auth();if(!profile)throw Error("أنشئ ملف اللاعب أولًا.");
  if(title.value.trim().length<2)throw Error("اسم المسابقة يجب ألا يقل عن حرفين.");
  const qs=[];try{state.categories.forEach(cat=>cat.questions.forEach(q=>{if(q.q&&q.a)qs.push({category:cat.name,points:q.v,question:q.q,answer:q.a,seconds:q.time||30})}))}catch(e){}
  if(!qs.length)throw Error("لم أجد أسئلة مكتملة في لوحة المسابقة الحالية.");
  room=await rpc("ihyaa_create_room",{p_title:title.value.trim(),p_password:pass.value||null,p_settings:{},p_questions:qs});role="host";showRoom();
 },"gold");
 const join=node("div","ihyCard");join.append(node("h3","","الانضمام إلى غرفة"),node("p","ihyMuted","أدخل الكود الذي أرسله لك الهوست."));
 const code=field(join,"كود الغرفة","مثال: A1B2C3D4");code.maxLength=8;code.autocomplete="off";code.style.textTransform="uppercase";
 const pw=field(join,"كلمة المرور","إن وُجدت","password");
 button(join,"انضم إلى المسابقة",async()=>{await auth();if(!profile)throw Error("أنشئ ملف اللاعب أولًا.");if(!/^[A-Z0-9]{8}$/i.test(code.value.trim()))throw Error("أدخل كود غرفة صحيحًا مكوّنًا من 8 رموز.");room=await rpc("ihyaa_join_room",{p_code:code.value.trim().toUpperCase(),p_password:pw.value||null});role="player";showRoom()},"gold");
 grid.append(host,join);c.append(top,grid);
 if(profile){
  const archive=node("div","ihyCard ihySection");archive.append(node("h3","","أرشيف مسابقاتي"));
  const list=node("div","","جارٍ تحميل الأرشيف…");archive.append(list);
  rpc("ihyaa_host_list_rooms").then(rows=>{list.innerHTML="";if(!rows.length){list.append(node("p","ihyMuted","لا توجد مسابقات محفوظة بعد."));return}rows.forEach(r=>{const item=node("div","ihyPerson");item.append(node("strong","",r.title+" • "+r.code),node("p","ihyMuted",r.status==="archived"?"مؤرشفة":r.status==="live"?"جارية":"في الانتظار"));button(item,"فتح السجل",async()=>{room={room_id:r.room_id,code:r.code,title:r.title};role="host";showRoom(true)});list.append(item)})}).catch(e=>{list.textContent=e.message});c.append(archive)
 }
 shell("مؤسسة إحياء | المسابقات الأونلاين",c)
}
async function refresh(readOnly=false){if(!room)return;const v=await rpc("ihyaa_room_view",{p_room:room.room_id});const roster=$("ihyRoster");if(roster){roster.innerHTML="";(v.roster||[]).forEach(p=>{const row=node("div","ihyPerson",p.username+" • "+p.player_id+" • "+(p.team||"لم يحدد الفريق"));if(role==="host"&&p.role!=="host"&&v.status==="lobby"){const s=node("select");s.innerHTML='<option value="">تحديد الفريق</option><option value="red">الأحمر</option><option value="blue">الأزرق</option>';s.value=p.team||"";s.onchange=async()=>{try{await rpc("ihyaa_host_assign_member",{p_room:room.room_id,p_user:p.user_id,p_team:s.value});await refresh()}catch(e){fail(e)}};row.append(s)}roster.append(row)})}
const q=$("ihyQuestion");if(q){const questionId=v.question?.id||null;const renderedId=q.dataset.questionId===undefined?undefined:(q.dataset.questionId||null);if(questionId!==renderedId){const previousInput=q.querySelector("input");const previousValue=previousInput?.value||"";q.innerHTML="";q.dataset.questionId=questionId||"";if(v.question){q.append(node("div","ihyQuestion",v.question.question),node("p","","النقاط: "+v.question.points+" • الدور: "+(v.turn_team==="red"?"الأحمر":"الأزرق")));if(role==="host")q.append(node("div","ihyAnswer","الإجابة الصحيحة (للهوست فقط): "+v.question.answer));else{const input=field(q,"إجابتك","اكتب إجابتك");input.value=previousValue;button(q,"إرسال الإجابة",async()=>{if(!input.value.trim())throw Error("اكتب إجابتك أولًا");await rpc("ihyaa_submit_answer",{p_room:room.room_id,p_answer:input.value.trim()});input.disabled=true;alert("وصلت إجابتك للهوست") },"gold")}}else q.append(node("p","",v.status==="archived"?"هذه المسابقة مؤرشفة.":"بانتظار الهوست لفتح السؤال."))}else{const input=q.querySelector("input");if(input&&document.activeElement!==input&&input.disabled===false)input.value=input.value}}
const score=$("ihyScores");if(score)score.textContent=(v.settings?.red_name||"الفريق الأحمر")+": "+(v.scores.red||0)+" | "+(v.settings?.blue_name||"الفريق الأزرق")+": "+(v.scores.blue||0);
const status=$("ihyStatus");if(status)status.textContent=v.status==="live"?"المسابقة جارية":v.status==="archived"?"المسابقة مؤرشفة":"غرفة الانتظار";
if(role==="host"&&!readOnly&&v.status!=="archived"){const start=$("ihyStartMatch");if(start){const redCount=(v.roster||[]).filter(p=>p.role==="player"&&p.team==="red").length;const blueCount=(v.roster||[]).filter(p=>p.role==="player"&&p.team==="blue").length;const ready=redCount>0&&blueCount>0&&v.status==="lobby";start.disabled=!ready;start.textContent=ready?"ابدأ المسابقة الآن":"وزّع لاعبًا واحدًا على الأقل لكل فريق";}await hostRefresh(v)}}
async function hostRefresh(v){const questions=await rpc("ihyaa_host_list_questions",{p_room:room.room_id});const sel=$("ihySelect");if(sel){const old=sel.value;sel.innerHTML='<option value="">اختر سؤالًا</option>';questions.filter(q=>!q.used).forEach(q=>{const o=node("option","",q.category+" • "+q.points+" • "+q.question);o.value=q.id;sel.append(o)});sel.value=old}
const subs=await rpc("ihyaa_host_submissions",{p_room:room.room_id});const target=$("ihySubs");if(target){target.innerHTML="";if(!subs.length)target.append(node("p","ihyMuted","لا توجد إجابات معلقة"));subs.forEach(s=>{const card=node("div","ihyCard");card.append(node("strong","",s.username+" • "+s.player_id),node("p","",s.answer));button(card,"صحيحة",async()=>{await rpc("ihyaa_host_judge",{p_room:room.room_id,p_submission:s.id,p_correct:true});await refresh()},"gold");button(card,"خاطئة",async()=>{await rpc("ihyaa_host_judge",{p_room:room.room_id,p_submission:s.id,p_correct:false});await refresh()});target.append(card)})}}
function showRoom(readOnly=false){const c=node("div");const info=node("div","ihyCard");info.append(node("div","","كود الغرفة"),node("div","ihyCode",room.code),node("div","ihyMuted","حالة الدخول: "+(role==="host"?"أنت الهوست":"لاعب")));const status=node("p","ihyMuted","جارٍ التحديث…");status.id="ihyStatus";info.append(status);c.append(info,node("h3","","اللاعبون"),node("div","",""));const roster=node("div");roster.id="ihyRoster";c.append(roster,node("h3","","السؤال الحالي"));const q=node("div","ihyCard");q.id="ihyQuestion";c.append(q);const scores=node("div","ihyCard");scores.id="ihyScores";c.append(scores);
if(role==="host"&&!readOnly){const h=node("div","ihyCard");h.append(node("h3","","تحكم الهوست"));const invite=field(h,"إضافة لاعب باستخدام ID","مثال: A1B2C3D4");button(h,"إضافة اللاعب",async()=>{if(!invite.value.trim())throw Error("أدخل معرّف اللاعب");await rpc("ihyaa_host_invite_player",{p_room:room.room_id,p_player_id:invite.value.trim()});invite.value="";await refresh()},"gold");const red=field(h,"اسم الفريق الأحمر","الفريق الأحمر");const blue=field(h,"اسم الفريق الأزرق","الفريق الأزرق");const startBtn=button(h,"وزّع اللاعبين على الفريقين للبدء",async()=>{await rpc("ihyaa_host_start",{p_room:room.room_id,p_red_name:red.value||"الفريق الأحمر",p_blue_name:blue.value||"الفريق الأزرق"});await refresh()},"gold");startBtn.id="ihyStartMatch";startBtn.disabled=true;const sel=node("select");sel.id="ihySelect";h.append(node("label","","فتح سؤال"),sel);button(h,"اعرض السؤال للاعبين",async()=>{if(!sel.value)throw Error("اختر سؤالًا");await rpc("ihyaa_host_pick_question",{p_room:room.room_id,p_question:sel.value});await refresh()});h.append(node("h3","","إجابات اللاعبين"));const subs=node("div");subs.id="ihySubs";h.append(subs);button(h,"حفظ في الأرشيف",async()=>{if(!confirm("تأكيد حفظ المسابقة في الأرشيف؟"))return;await rpc("ihyaa_host_archive",{p_room:room.room_id});close();home()},"gold");c.append(h)}
button(c,"العودة",()=>{close();home()});shell(room.title+(readOnly?" | سجل مؤرشف":""),c);refresh(readOnly).catch(fail);if(!readOnly)timer=setInterval(()=>refresh().catch(()=>{}),2500)}
document.addEventListener("DOMContentLoaded",()=>{const nav=document.querySelector(".nav");if(!nav)return;const b=node("button","","🌐 مسابقات أونلاين");b.id="onlineOpen";b.style.cssText="margin-inline-start:8px;background:#e6c77b;color:#17352d;padding:10px 15px;border-radius:12px;font-weight:900";b.onclick=async()=>{try{await auth();await restoreProfile();home()}catch(e){if(!ready()){const c=node("div","ihyCard");c.append(node("h3","","تفعيل الغرف الجماعية"),node("p","ihyMuted","الغرف تحتاج ربط Supabase مرة واحدة حتى يستطيع اللاعبون الدخول من أجهزة مختلفة."),node("p","ihyMuted","افتح ملف supabase-config.js في المستودع، واستبدل YOUR_SUPABASE_ANON_KEY بمفتاح Publishable أو anon العام من Supabase → Project Settings → API Keys. لا تستخدم Secret أو service_role ولا تشارك المفتاح السري."),node("p","ihyMuted","بعد حفظ الملف، حدّث الصفحة وابدأ إنشاء الغرفة."));shell("إعداد الاتصال بالمسابقات",c)}else fail(e)}};nav.append(b)});
})();