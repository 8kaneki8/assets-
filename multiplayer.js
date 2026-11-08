(()=> {
const URL=window.IHYAA_SUPABASE_URL||"", KEY=window.IHYAA_SUPABASE_ANON_KEY||"";
let db=null, room=null, role=null, timer=null, profile=null, busy=false;
const $=id=>document.getElementById(id);
const node=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
const rpc=async(name,args={})=>{const r=await db.rpc(name,args);if(r.error)throw r.error;return r.data};
const ready=()=>window.supabase&&URL.startsWith("https://")&&!URL.includes("YOUR_PROJECT")&&KEY&&!KEY.includes("YOUR_SUPABASE");
const style=node("style");style.textContent=`#ihyaaOnline{position:fixed;inset:0;z-index:10030;background:#071b16d9;display:none;align-items:center;justify-content:center;padding:14px;backdrop-filter:blur(8px)}#ihyaaOnline.open{display:flex}.ihyBox{background:#faf9f4;color:#17352d;width:min(940px,100%);max-height:92vh;overflow:auto;border:1px solid #c6a45b;border-radius:22px;padding:20px}.ihyBox h2{margin:0 0 16px}.ihyGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.ihyCard{background:white;border:1px solid #e5e1d6;border-radius:13px;padding:13px;margin:9px 0}.ihyBox input,.ihyBox select{width:100%;padding:11px;border:1px solid #d7d8cd;border-radius:9px;margin:5px 0 12px}.ihyBtn{border:0;border-radius:10px;padding:10px 14px;margin:4px;background:#0d5946;color:white;font-weight:800;cursor:pointer}.ihyBtn.gold{background:#c6a45b;color:#17352d}.ihyCode{font-size:26px;letter-spacing:3px;font-weight:900;color:#0d5946}.ihyPerson{padding:9px;background:#f2f1e9;border-radius:9px;margin:5px 0}.ihyQuestion{font-size:22px;font-weight:900;padding:16px;background:#f1efe5;border-radius:12px;line-height:1.8}.ihyAnswer{background:#e4f1e8;padding:12px;border-radius:10px;margin:8px 0}.ihyMuted{color:#718078;font-size:13px;line-height:1.8}.ihySection{margin-top:16px;padding-top:12px;border-top:1px solid #e8e3d7}`;
document.head.append(style);
/* CLASSIC BOARD + DEDICATED HOST CONSOLE */
.ihyRoomShell{direction:rtl;color:#183653;max-width:1400px;margin:0 auto}
.ihyRoomHero{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap;padding:22px;border-radius:20px;background:linear-gradient(120deg,#0b2343,#174d7d 65%,#236ba8);color:#fff;box-shadow:0 18px 42px #123c681f}
.ihyRoomIdentity h2{font-size:clamp(22px,3vw,32px);margin:5px 0;color:#fff}.ihyRoomIdentity p{margin:0;color:#d7e8f8}.ihyRoomKicker{font-size:11px;letter-spacing:.4px;color:#f0d99d;font-weight:900}.ihyRoomCodeBox{display:grid;gap:3px;padding:12px 18px;border:1px solid #ffffff44;border-radius:15px;background:#ffffff12;text-align:center;min-width:140px}.ihyRoomCodeBox span{font-size:11px;color:#d7e8f8}.ihyRoomCodeBox .ihyCode{font-size:26px;letter-spacing:3px;color:#f2d48b;direction:ltr}
.ihyRoomStatusBar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0;padding:12px 16px;border:1px solid #d4e1ef;border-radius:14px;background:#f5f9fe;color:#24486f}.ihyTurnBadge{padding:7px 12px;border-radius:999px;background:#e8f0fa;color:#1c568c;font-size:12px;font-weight:900}
.ihyScores{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}.ihyScoreCard{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px 18px;border:1px solid #d5e1ef;border-radius:16px;background:#fff;box-shadow:0 8px 20px #21466e0a}.ihyScoreCard span{font-weight:900;color:#284c70}.ihyScoreCard strong{font-size:30px;font-weight:900}.ihyScoreRed{border-top:4px solid #c94e5d}.ihyScoreRed strong{color:#b33d4c}.ihyScoreBlue{border-top:4px solid #347bc4}.ihyScoreBlue strong{color:#2465a2}
.ihyRoomLayout{display:grid;grid-template-columns:minmax(0,1fr) minmax(270px,340px);gap:16px;align-items:start}.ihyRoomMain,.ihyRoomSide{min-width:0}.ihyRoomSide{display:grid;gap:12px}.ihyBoardPanel,.ihyQuestionPanel,.ihyHostPanel{padding:17px;border:1px solid #d5e1ef;border-radius:18px;background:#fff;box-shadow:0 10px 28px #244b760c;margin:0 0 14px}.ihyBoardHeading{font-size:19px;font-weight:900;color:#173b66}.ihyBoardCategories{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-top:12px}.ihyCategoryCard{padding:12px;border:1px solid #d7e3f0;border-radius:15px;background:linear-gradient(145deg,#fafdff,#edf4fc);min-width:0}.ihyCategoryCard h3{margin:0 0 10px;text-align:center;color:#164a83;font-size:15px;font-weight:900;line-height:1.6;min-height:42px;display:grid;place-items:center}.ihyPointsGrid{display:grid;grid-template-columns:1fr;gap:8px}.ihyPointBtn{min-height:51px;border:1px solid #2636a0;border-radius:7px;background:linear-gradient(145deg,#343acb,#2934ae);color:#ffe08a;font-size:19px;font-weight:900;box-shadow:inset 0 1px #ffffff20,0 3px 0 #151b72;transition:transform .18s,filter .18s}.ihyPointBtn:hover:not(:disabled){transform:translateY(-2px);filter:brightness(1.12)}.ihyPointBtn:disabled{opacity:.62;cursor:not-allowed}.ihyPointBtn.used{background:#e9eef4;color:#7b8da2;border-color:#d2dce8;box-shadow:none;font-size:13px}
.ihyRosterList{display:grid;gap:7px}.ihyRosterList .ihyPerson{display:grid;gap:7px;padding:10px 12px;border:1px solid #dce6f1;border-radius:12px;background:#f5f9fe;color:#294b6e;font-size:12px}.ihyRosterList select{width:100%;padding:8px;border:1px solid #cbd9e8;border-radius:9px;background:white;color:#23486f}.ihyHostPanel{border-top:4px solid #c6a45b}.ihyHostPanelHead{font-size:18px;font-weight:900;color:#173b66}.ihyHostPanel .ihyHostInput{margin:5px 0 9px}.ihyHostPanel .ihyHostAction,.ihyHostPanel .ihyStartMatch{width:100%;min-height:45px}.ihyHostPanel .ihyStartMatch{font-size:15px;padding:12px;margin:8px 0}.ihyHostPanel .ihyStartMatch:disabled{opacity:.5}.ihySubmissionsTitle{margin-top:18px;padding-top:13px;border-top:1px solid #dce6f1;color:#173b66}.ihySubmissions .ihyCard{margin:8px 0}.ihyQuestionPanel .ihyQuestion{background:#edf4fc;color:#173b66;border:1px solid #d7e3f0;border-radius:14px}.ihyQuestionPanel .ihyAnswer{background:#e8f5ed;color:#1b6241;border:1px solid #c9e6d4;font-weight:900}.ihyBackButton{width:100%;margin-top:14px;background:#eaf1fa!important;color:#214f80!important}
@media(max-width:850px){.ihyRoomLayout{grid-template-columns:1fr}.ihyRoomSide{grid-template-columns:1fr}.ihyBoardCategories{grid-template-columns:repeat(auto-fit,minmax(155px,1fr))}}
@media(max-width:520px){.ihyRoomHero{padding:16px}.ihyScores{gap:8px}.ihyScoreCard{padding:12px}.ihyScoreCard strong{font-size:24px}.ihyBoardPanel,.ihyQuestionPanel,.ihyHostPanel{padding:12px}.ihyBoardCategories{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ihyCategoryCard{padding:8px}.ihyPointBtn{min-height:46px;font-size:17px}}


style.textContent+=`

/* IHYAA PREMIUM BLUE/GOLD PLAYER SIGN-IN */
#ihyaaOnline{background:radial-gradient(ellipse at 15% 10%,#3476b044,transparent 42%),#06152be8!important;padding:clamp(12px,3vw,28px)!important;backdrop-filter:blur(14px)!important}
.ihyBox{width:min(980px,100%)!important;max-height:min(92vh,900px)!important;padding:clamp(16px,3vw,30px)!important;border:1px solid #9fc3ed70!important;border-radius:26px!important;background:linear-gradient(145deg,#fafdff 0%,#edf4fc 55%,#e6effb 100%)!important;color:#142c4a!important;box-shadow:0 35px 100px #0009,0 0 0 1px #ffffff30 inset!important;position:relative}
.ihyBox>h2{font-size:clamp(20px,3vw,28px)!important;color:#173b66!important;margin:0 0 18px!important;padding:5px 0 14px!important;border-bottom:1px solid #c9d9ec}
.ihyAuthLayout{max-width:850px!important;gap:16px!important}
.ihyAuthPanel{border:1px solid #cbdced!important;border-radius:22px!important;padding:clamp(18px,3vw,30px)!important;background:linear-gradient(145deg,#fff,#f2f7fd)!important;box-shadow:0 18px 45px #244b7612!important;position:relative;overflow:hidden}
.ihyAuthPanel:before{content:"";position:absolute;width:220px;height:220px;border:1px solid #a9c8ed40;border-radius:50%;top:-145px;left:-90px;box-shadow:0 0 0 22px #a9c8ed10,0 0 0 44px #a9c8ed08;pointer-events:none}
.ihyAuthIntro{position:relative;padding:8px 8px 20px!important}
.ihyAuthMark{width:62px!important;height:62px!important;border-radius:20px!important;background:linear-gradient(145deg,#1b5b91,#102c50)!important;color:#f2d38d!important;box-shadow:0 12px 28px #174a7e35,0 0 0 5px #dceafb!important;font-size:30px!important;margin-bottom:16px!important}
.ihyAuthIntro>div:nth-child(2){font-size:clamp(19px,3vw,25px);font-weight:900;color:#173b66}
.ihyAuthIntro .ihyMuted{max-width:520px;margin:9px auto 0;color:#647b96!important;line-height:2!important}
.ihyAuthLabel{color:#24486f!important;font-size:13px;margin:12px 0 9px!important}
.ihyAuthInput{min-height:54px!important;border:1px solid #c6d6e8!important;border-radius:14px!important;padding:14px 16px!important;background:#fff!important;color:#142c4a!important;box-shadow:0 4px 14px #1e47700a!important;transition:border-color .2s,box-shadow .2s,transform .2s!important}
.ihyAuthInput:focus{border-color:#4d88c6!important;box-shadow:0 0 0 4px #6ca1d433!important;transform:translateY(-1px)}
.ihyAuthInput::placeholder{color:#91a3b8}
.ihyAuthSubmit{min-height:54px!important;border-radius:14px!important;background:linear-gradient(120deg,#e8cf91,#c39a4d)!important;color:#183657!important;font-size:14px!important;font-weight:900!important;box-shadow:0 12px 25px #b18a4530!important;transition:transform .2s,filter .2s!important}
.ihyAuthSubmit:hover{transform:translateY(-2px);filter:brightness(1.04)}
.ihyAuthPanel .ihyMuted{color:#71859e!important}
.ihyAuthError{border-radius:13px!important;box-shadow:0 8px 20px #9b3d2410}
.ihyIdentity{background:linear-gradient(145deg,#eaf3fd,#f8fbff)!important;border:1px solid #c5d9ee!important;border-radius:17px!important;padding:18px!important}
.ihyIdentityName{color:#173b66!important;font-size:25px!important}
.ihyPlayerId{color:#2c659a!important}
.ihyCard{border-color:#d5e1ef!important;border-radius:16px!important;box-shadow:0 8px 22px #244b7609}
.ihyBtn{border-radius:12px!important;transition:transform .18s,filter .18s!important}
.ihyBtn:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.04)}
.ihyBtn.gold{background:linear-gradient(120deg,#e8cf91,#c39a4d)!important;color:#183657!important}
.ihyEditBtn{background:#e6eef8!important;color:#24486f!important}
.ihyCode{color:#235b91!important}.ihyPerson{background:#f0f5fb!important}
@media(max-width:560px){.ihyBox{border-radius:19px!important}.ihyAuthPanel{padding:17px!important}.ihyAuthMark{width:54px!important;height:54px!important}}

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
`;

style.textContent+=`\n.ihyPointsGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:9px;margin-top:10px}.ihyPointBtn{border:1px solid #c8d9ec;border-radius:12px;padding:13px 8px;background:linear-gradient(145deg,#fff,#eaf2fb);color:#1c4d7d;font-weight:900;font-size:16px;cursor:pointer;min-height:54px}.ihyPointBtn:hover:not(:disabled){border-color:#c39a4d;transform:translateY(-2px)}.ihyPointBtn:disabled{opacity:.48;cursor:not-allowed}.ihyPointBtn.used{background:#edf0f3;color:#718096}\n`;
const modal=node("div");modal.id="ihyaaOnline";const box=node("div","ihyBox");modal.append(box);document.body.append(modal);
const close=()=>{modal.classList.remove("open");if(timer)clearInterval(timer);timer=null};
const shell=(title,content)=>{box.innerHTML="";const h=node("h2","",title);box.append(h,content);const x=node("button","ihyBtn","إغلاق");x.onclick=close;box.insertBefore(x,h);modal.classList.add("open")};
const field=(parent,label,placeholder,type)=>{parent.append(node("label","",label));const i=node("input");i.placeholder=placeholder||"";i.type=type||"text";parent.append(i);return i};
const button=(parent,label,fn,cls)=>{const b=node("button","ihyBtn "+(cls||""),label);b.onclick=async()=>{if(busy)return;busy=true;b.disabled=true;try{await fn()}catch(e){fail(e)}finally{busy=false;b.disabled=false}};parent.append(b);return b};
const fail=e=>{
 const raw=String(e?.message||e||"حدث خطأ غير متوقع");
 const msg=raw.includes("Invalid login")?"تعذر استعادة جلسة اللاعب. حدّث الصفحة وحاول إنشاء ملف اللاعب من جديد."
  :raw.includes("Failed to fetch")||raw.includes("NetworkError")?"تعذر الاتصال بخادم المسابقة. تحقق من الإنترنت ثم أعد المحاولة."
  :raw.includes("Anonymous sign-ins are disabled")?"تسجيل دخول اللاعبين غير مفعّل في إعدادات Supabase."
  :raw.includes("User already registered")?"هذا الحساب موجود بالفعل. جرّب تسجيل الدخول من نفس المتصفح الذي أنشأته منه."
  :raw.includes("permission denied")||raw.includes("row-level security")?"الخادم رفض العملية بسبب صلاحيات قاعدة البيانات. يجب مراجعة سياسات RLS ودوال إحياء."
  :raw.includes("Could not find the function")||raw.includes("does not exist")?"قاعدة البيانات لا تحتوي على الدالة المطلوبة أو أن تحديث SQL لم يُطبّق بعد."
  :raw;
 const old=$("ihyAuthError");if(old)old.remove();
 const target=$("ihyAuthPanel")||box;
 const error=node("p","ihyAuthError",msg);error.setAttribute("role","alert");target.prepend(error);
 modal.classList.add("open");
};
let authPromise=null;
async function auth(){
 if(!ready())throw Error("خدمة الدخول غير مهيأة. تأكد من تحميل Supabase وملف supabase-config.js.");
 if(!db)db=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 if(authPromise)return authPromise;
 authPromise=(async()=>{
  const current=await db.auth.getSession();
  if(current.error)throw current.error;
  if(!current.data?.session){
   const signed=await db.auth.signInAnonymously();
   if(signed.error){
    const message=String(signed.error.message||"");
    if(/disabled|not enabled|anonymous/i.test(message))throw Error("تسجيل دخول اللاعبين غير مفعّل في Supabase. فعّل Anonymous Sign-Ins من Authentication → Sign In / Providers.");
    throw signed.error;
   }
  }
  const user=await db.auth.getUser();
  if(user.error)throw user.error;
  if(!user.data?.user)throw Error("لم يتم إنشاء جلسة لاعب. أعد المحاولة بعد تحديث الصفحة.");
  return true;
 })();
 try{return await authPromise}finally{authPromise=null}
}
async function restoreProfile(){
 if(!db)return null;
 const user=await db.auth.getUser();if(user.error)throw user.error;
 if(!user.data.user){profile=null;return null;}
 const r=await db.from("ihyaa_profiles").select("username,public_id").eq("user_id",user.data.user.id).maybeSingle();
 if(r.error){
  if(r.error.code==="42501"||/row-level security|permission denied/i.test(String(r.error.message||""))){profile=null;return null}
  throw r.error;
 }
 profile=r.data?{username:r.data.username,player_id:r.data.public_id}:null;return profile;
}
async function login(name){
 const clean=String(name||"").normalize("NFKC").trim().replace(/\s+/g," ");
 if(clean.length<2||clean.length>24)throw Error("اسم اللاعب يجب أن يكون من حرفين إلى 24 حرفًا.");
 if(!/^[\p{L}\p{N} _.-]+$/u.test(clean))throw Error("استخدم الحروف والأرقام والمسافة أو الرموز البسيطة فقط.");
 await auth();
 let result=await rpc("ihyaa_register",{p_username:clean});
 if(Array.isArray(result))result=result[0];
 if(!result||typeof result!=="object")throw Error("تم الاتصال بالخادم لكن لم تصل بيانات ملف اللاعب. تحقق من تحديث قاعدة بيانات إحياء.");
 const username=result.username||result.name;
 const playerId=result.player_id||result.public_id;
 if(!username||!playerId)throw Error("الخادم لم يُرجع اسم اللاعب ومعرّفه بالشكل المتوقع. راجع دالة ihyaa_register في Supabase.");
 profile={username,player_id:playerId};
 home();
}
async function loadRoomSuggestions(target){
  target.textContent="جارٍ البحث عن الغرف المتاحة…";
  try{
   const rows=await rpc("ihyaa_list_public_rooms");
   target.innerHTML="";
   if(!Array.isArray(rows)||!rows.length){target.append(node("p","ihyMuted","لا توجد غرف تنتظر لاعبين حاليًا. يمكنك إنشاء غرفة أو تحديث الاقتراحات لاحقًا."));return}
   rows.forEach(r=>{
    const item=node("div","ihyPerson");
    const title=node("strong","",r.title||"مسابقة بدون عنوان");
    const meta=node("p","ihyMuted",(r.has_password?"🔒 محمية بكلمة مرور":"🌐 مفتوحة للجميع")+" • المضيف: "+(r.host_name||"غير معروف")+" • اللاعبون: "+(r.player_count||0)+" • الكود: "+r.code);
    const actions=node("div","");let pass=null;
    if(r.has_password)pass=field(actions,"كلمة مرور الغرفة","أدخل كلمة المرور للانضمام","password");
    button(actions,"انضم إلى الغرفة",async()=>{
     await auth();if(!profile)throw Error("أنشئ ملف اللاعب بالاسم أولًا.");
     room=await rpc("ihyaa_join_room",{p_code:String(r.code||"").toUpperCase(),p_password:pass?pass.value:null});
     role="player";showRoom();
    },"gold");
    item.append(title,meta,actions);target.append(item);
   });
  }catch(e){
   target.innerHTML="";
   target.append(node("p","ihyMuted","تعذر تحميل اقتراحات الغرف. قد يحتاج مسؤول الموقع إلى تطبيق تحديث قاعدة البيانات الخاص باكتشاف الغرف. "+String(e?.message||e)));
  }
}
async function refreshSavedQuizzes(target){
 target.textContent="جارٍ تحميل مجموعات الأسئلة…";
 try{
  await auth();
  const rows=await rpc("ihyaa_list_saved_quizzes");target.innerHTML="";
  if(!Array.isArray(rows)||!rows.length){target.append(node("p","ihyMuted","لا توجد مجموعات محفوظة بعد. أنشئ مجموعة واختر الأسئلة التي تريد استخدامها في مسابقاتك القادمة."));return}
  rows.forEach(q=>{
   const item=node("div","ihyPerson");item.append(node("strong","",q.title),node("p","ihyMuted",(q.question_count||0)+" سؤال • محفوظة في مكتبتك الخاصة"));
   const actions=node("div","");const pass=field(actions,"كلمة مرور الغرفة (اختياري)","اتركها فارغة لغرفة مفتوحة","password");
   button(actions,"استضافة هذه المجموعة",async()=>{const saved=await rpc("ihyaa_get_saved_quiz",{p_quiz:q.id});const questions=[...(saved.questions||[])].sort((a,b)=>Number(a.points||0)-Number(b.points||0));room=await rpc("ihyaa_create_room",{p_title:saved.title,p_password:pass.value||null,p_settings:{},p_questions:questions});role="host";showRoom()},"gold");
   button(actions,"تعديل الأسئلة",async()=>{const saved=await rpc("ihyaa_get_saved_quiz",{p_quiz:q.id});openQuestionSetEditor(libraryEditor,saved.questions,q.id,()=>refreshSavedQuizzes(target),saved.title)},"ihyEditBtn");
   button(actions,"نسخ المجموعة",async()=>{const saved=await rpc("ihyaa_get_saved_quiz",{p_quiz:q.id});const proposed=String(saved.title||q.title)+" - نسخة";const copiedTitle=window.prompt("اكتب اسم المجموعة المنسوخة",proposed);if(copiedTitle===null)return;if(copiedTitle.trim().length<2)throw Error("اسم المجموعة يجب أن يكون من حرفين على الأقل.");await rpc("ihyaa_save_quiz",{p_title:copiedTitle.trim(),p_questions:saved.questions});await refreshSavedQuizzes(target);await refreshSavedSetOptions()},"ihyEditBtn");
   button(actions,"حذف المجموعة",async()=>{if(!confirm("حذف مجموعة الأسئلة من مكتبتك؟"))return;await rpc("ihyaa_delete_saved_quiz",{p_quiz:q.id});await refreshSavedQuizzes(target);await refreshSavedSetOptions()},"ihyEditBtn");
   item.append(actions);target.append(item);
  });
 }catch(e){
  target.innerHTML="";
  const raw=String(e?.message||e||"");
  const missing=/Could not find the function|function public\\.ihyaa_(list|save|get|delete|update)_saved_quiz|does not exist|schema cache/i.test(raw);
  const denied=/permission denied|row-level security|not allowed/i.test(raw);
  const message=missing
   ?"تحديث قاعدة بيانات مكتبة الأسئلة غير مُطبّق أو لم تُحدّث ذاكرة الدوال بعد. افتح Supabase → SQL Editor وشغّل الملف supabase/patches/2026-11-08-question-library-repair.sql ثم أعد تحميل اللعبة."
   :denied?"تم رفض الوصول إلى مكتبة الأسئلة. تأكد من تفعيل Anonymous Sign-ins وتشغيل تحديث المكتبة بحساب المشروع الصحيح."
   :"تعذر تحميل مكتبة الأسئلة: "+raw;
  target.append(node("p","ihyMuted",message));
 }
}
let libraryEditor=null;
async function refreshSavedSetOptions(){
 const select=$("ihySavedSetSelect");if(!select)return;
 try{
  await auth();const rows=await rpc("ihyaa_list_saved_quizzes");
  select.innerHTML='<option value="">استخدم أسئلة لوحة اللعبة الحالية</option>';
  if(Array.isArray(rows)&&rows.length){
   const all=node("option","","📚 المكتبة كاملة — كل المجموعات ("+rows.length+")");
   all.value="__ihyaa_all_saved_library__";select.append(all);
   const divider=node("option","","──────── المجموعات الفردية ────────");divider.disabled=true;select.append(divider);
   rows.forEach(q=>{const o=node("option","",q.title+" • "+(q.question_count||0)+" سؤال");o.value=q.id;select.append(o)});
  }
 }catch(e){select.innerHTML='<option value="">تعذر تحميل المكتبة</option>'}
}
window.ihyaaSaveAllQuestionGroupsToOnlineLibrary=async function(payload={}){
 await auth();
 if(!profile)await restoreProfile();
 if(!profile){home();throw Error("سجّل اسم اللاعب أولًا من نافذة المسابقات الأونلاين، ثم ارجع واضغط حفظ كل المجموعات.");}
 const groups=(Array.isArray(payload.groups)?payload.groups:[]).map(g=>({
  title:String(g.title||"").trim(),
  questions:(Array.isArray(g.questions)?g.questions:[]).map(q=>({
   category:String(q.category||g.title||"عام").trim()||"عام",
   points:Number(q.points)||100,
   question:String(q.question||"").trim(),
   answer:String(q.answer||"").trim(),
   seconds:Number(q.seconds)||30
  })).filter(q=>q.question&&q.answer).sort((a,b)=>a.points-b.points)
 })).filter(g=>g.title.length>=2&&g.questions.length);
 if(!groups.length)throw Error("لا توجد مجموعات مكتملة للحفظ.");
 for(const group of groups){
  if(group.questions.some(q=>!Number.isFinite(q.points)||q.points<1||q.points>10000||q.seconds<5||q.seconds>300))throw Error("تحقق من النقاط ووقت الإجابة في مجموعة: "+group.title);
 }
 const existing=await rpc("ihyaa_list_saved_quizzes");
 let saved=0,total=0;
 for(const group of groups){
  const match=(existing||[]).find(item=>String(item.title||"").trim()===group.title);
  if(match?.id)await rpc("ihyaa_update_saved_quiz",{p_quiz:match.id,p_title:group.title,p_questions:group.questions});
  else await rpc("ihyaa_save_quiz",{p_title:group.title,p_questions:group.questions});
  saved++;total+=group.questions.length;
 }
 await refreshSavedSetOptions();
 return {saved,questions:total};
};
function openQuestionSetEditor(target,questions=[],replaceId=null,onSaved=()=>{},titleValue=""){
 if(!target)return;target.innerHTML="";
 const panel=node("div","ihyCard");panel.append(node("h3","",replaceId?"تعديل مجموعة الأسئلة":"إنشاء مجموعة أسئلة جديدة"),node("p","ihyMuted","اختر أسئلة جاهزة من لوحة اللعبة أو أضف أسئلة بنفسك. لن تظهر الإجابات الصحيحة للاعبين."));
 const title=field(panel,"اسم المجموعة","مثال: الأدب مع الله");title.value=titleValue||"";
 const rows=node("div","");
 const sortRows=()=>[...rows.children].sort((a,b)=>Number(a._read?.().points||0)-Number(b._read?.().points||0)).forEach(card=>rows.append(card));
 const addRow=(q={})=>{
  const card=node("div","ihyCard");
  const category=field(card,"الفئة","مثال: العقيدة");category.value=q.category||"عام";
  const points=field(card,"النقاط","100","number");points.value=String(q.points||100);points.min="1";points.max="10000";points.addEventListener("input",sortRows);
  const seconds=field(card,"الوقت بالثواني","30","number");seconds.value=String(q.seconds||30);seconds.min="5";seconds.max="300";
  const question=field(card,"نص السؤال","اكتب السؤال");question.value=q.question||"";
  const answer=field(card,"الإجابة الصحيحة","اكتب الإجابة");answer.value=q.answer||"";
  const remove=node("button","ihyBtn ihyEditBtn","إزالة السؤال");remove.type="button";remove.onclick=()=>card.remove();card.append(remove);
  card._read=()=>({category:category.value.trim()||"عام",points:Number(points.value)||100,seconds:Number(seconds.value)||30,question:question.value.trim(),answer:answer.value.trim()});rows.append(card);sortRows();
 };
 (questions||[]).slice().sort((a,b)=>Number(a.points||0)-Number(b.points||0)).forEach(addRow);
 const pool=node("div","ihyCard");pool.append(node("strong","","اختيار من أسئلة لوحة اللعبة الحالية"),node("p","ihyMuted","حدد الأسئلة التي تريد إضافتها إلى المجموعة. يمكنك تعديلها بعد إضافتها."));
 try{(state.categories||[]).forEach((cat,ci)=>(cat.questions||[]).forEach((q,qi)=>{
  if(!String(q.q||"").trim()||!String(q.a||"").trim())return;
  const label=node("label","ihyPerson");label.style.display="flex";label.style.gap="10px";label.style.alignItems="flex-start";
  const check=node("input");check.type="checkbox";check.style.width="20px";check.style.margin="4px 0 0";
  const copy=node("span","",cat.name+" • "+(q.v||100)+" نقطة — "+q.q);
  check.onchange=()=>{if(check.checked)addRow({category:cat.name,points:q.v||100,seconds:q.time||30,question:q.q,answer:q.a})};
  label.append(check,copy);pool.append(label);
 }))}catch(e){pool.append(node("p","ihyMuted","لا توجد أسئلة جاهزة؛ يمكنك إضافة أسئلة يدويًا."))}
 const add=node("button","ihyBtn ihyEditBtn","＋ إضافة سؤال يدوي");add.type="button";add.onclick=()=>addRow();pool.append(add);
 const actions=node("div","");const save=node("button","ihyBtn gold","حفظ المجموعة");save.type="button";
 const cancel=node("button","ihyBtn ihyEditBtn","إلغاء");cancel.type="button";cancel.onclick=()=>{target.innerHTML="";target.append(node("p","ihyMuted","تم إغلاق محرر المجموعة."))};
 save.onclick=async()=>{
  if(busy)return;const qs=[...rows.children].map(x=>x._read()).filter(x=>x.question&&x.answer).sort((a,b)=>a.points-b.points);
  if(title.value.trim().length<2)throw Error("اسم المجموعة يجب أن يكون من حرفين على الأقل.");
  if(!qs.length)throw Error("اختر سؤالًا واحدًا على الأقل واكتب إجابته.");
  if(qs.some(x=>x.points<1||x.points>10000||x.seconds<5||x.seconds>300))throw Error("النقاط من 1 إلى 10000 والوقت من 5 إلى 300 ثانية.");
  busy=true;save.disabled=true;save.textContent="جارٍ حفظ المجموعة…";
  try{if(replaceId){await rpc("ihyaa_update_saved_quiz",{p_quiz:replaceId,p_title:title.value.trim(),p_questions:qs})}else{await rpc("ihyaa_save_quiz",{p_title:title.value.trim(),p_questions:qs})}target.innerHTML="";target.append(node("p","ihyMuted","✓ تم حفظ مجموعة الأسئلة. يمكنك استضافتها الآن أو استخدامها في أي غرفة جديدة."));await onSaved();await refreshSavedSetOptions()}
  catch(e){fail(e)}finally{busy=false;save.disabled=false;save.textContent="حفظ المجموعة"}
 };
 actions.append(save,cancel);target.append(panel,pool,rows,actions);
}
function home(){
 const c=node("div","ihyAuthLayout");
 const top=node("div","ihyAuthPanel");top.id="ihyAuthPanel";
 const intro=node("div","ihyAuthIntro");
 intro.append(node("div","ihyAuthMark","إ"),node("div","", "أهلًا بك في مؤسسة إحياء"),node("p","ihyMuted","أنشئ هويتك للمشاركة في المسابقات. اكتب الاسم الذي سيظهر للاعبين — بدون بريد إلكتروني أو كلمة مرور."));
 top.append(intro);
 if(!profile){
  const label=node("label","ihyAuthLabel","اسم اللاعب");
  const name=node("input","ihyAuthInput");name.id="ihyPlayerName";name.type="text";name.placeholder="مثال: فارس المعرفة";name.maxLength=24;name.autocomplete="nickname";name.minLength=2;name.setAttribute("aria-label","اسم اللاعب");name.spellcheck=false;
  const hint=node("p","ihyMuted","من حرفين إلى 24 حرفًا • الحروف والأرقام والمسافة مسموحة • سيظهر هذا الاسم داخل الغرف والنتائج.");
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
 const savedSet=node("select");savedSet.id="ihySavedSetSelect";savedSet.style.cssText="width:100%;padding:11px;border:1px solid #d7d8cd;border-radius:9px;margin:5px 0 12px;background:#fff;color:#17352d";
 savedSet.innerHTML='<option value="">استخدم أسئلة لوحة اللعبة الحالية</option>';
 host.append(node("label","","مصدر الأسئلة"),savedSet,node("p","ihyMuted","اختر «المكتبة كاملة» لإضافة كل المجموعات إلى غرفة واحدة، أو اختر مجموعة منفردة، أو استخدم أسئلة لوحة اللعبة الحالية."));
 button(host,"إنشاء غرفة",async()=>{
  await auth();if(!profile)throw Error("أنشئ ملف اللاعب أولًا.");
  if(title.value.trim().length<2)throw Error("اسم المسابقة يجب ألا يقل عن حرفين.");
  let qs=[];
  if(savedSet.value==="__ihyaa_all_saved_library__"){
   const groups=await rpc("ihyaa_list_saved_quizzes");
   if(!Array.isArray(groups)||!groups.length)throw Error("لا توجد مجموعات محفوظة في المكتبة.");
   const loaded=await Promise.all(groups.map(g=>rpc("ihyaa_get_saved_quiz",{p_quiz:g.id})));
   loaded.forEach((saved,index)=>{
    const groupTitle=String(saved.title||groups[index].title||"مجموعة أسئلة");
    (saved.questions||[]).forEach(q=>{if(q.question&&q.answer)qs.push({...q,category:q.category&&q.category!=="عام"?q.category:groupTitle})});
   });
   qs.sort((a,b)=>Number(a.points||0)-Number(b.points||0));
  }else if(savedSet.value){
   const saved=await rpc("ihyaa_get_saved_quiz",{p_quiz:savedSet.value});
   qs=[...(saved.questions||[])].sort((a,b)=>Number(a.points||0)-Number(b.points||0));
  }else{try{state.categories.forEach(cat=>cat.questions.forEach(q=>{if(q.q&&q.a)qs.push({category:cat.name,points:q.v,question:q.q,answer:q.a,seconds:q.time||30})}))}catch(e){}}
  if(!qs.length)throw Error("لا توجد أسئلة في مصدر الأسئلة المختار.");
  room=await rpc("ihyaa_create_room",{p_title:title.value.trim(),p_password:pass.value||null,p_settings:{},p_questions:qs});role="host";showRoom();
 },"gold");

 const join=node("div","ihyCard");join.append(node("h3","","الانضمام إلى غرفة"),node("p","ihyMuted","أدخل الكود الذي أرسله لك الهوست."));
 const code=field(join,"كود الغرفة","مثال: A1B2C3D4");code.maxLength=8;code.autocomplete="off";code.style.textTransform="uppercase";
 const pw=field(join,"كلمة المرور","إن وُجدت","password");
 button(join,"انضم إلى المسابقة",async()=>{await auth();if(!profile)throw Error("أنشئ ملف اللاعب أولًا.");if(!/^[A-Z0-9]{8}$/i.test(code.value.trim()))throw Error("أدخل كود غرفة صحيحًا مكوّنًا من 8 رموز.");room=await rpc("ihyaa_join_room",{p_code:code.value.trim().toUpperCase(),p_password:pw.value||null});role="player";showRoom()},"gold");
 grid.append(host,join);c.append(top,grid);
  const discover=node("div","ihyCard ihySection");discover.append(node("h3","","الغرف المتاحة الآن"),node("p","ihyMuted","تظهر هنا كل الغرف التي ما زالت في الانتظار، سواء كانت مفتوحة أو محمية بكلمة مرور."));
  const discoverTools=node("div","");const refreshRooms=node("button","ihyBtn ihyEditBtn","↻ تحديث الاقتراحات");const roomList=node("div","","جارٍ البحث عن الغرف المتاحة…");
  refreshRooms.onclick=()=>loadRoomSuggestions(roomList);discoverTools.append(refreshRooms);discover.append(discoverTools,roomList);c.append(discover);
  loadRoomSuggestions(roomList);
 if(profile){
  const library=node("div","ihyCard ihySection");
  library.append(node("h3","","مكتبة مجموعات الأسئلة"),node("p","ihyMuted","أنشئ مجموعاتك الخاصة، اختر الأسئلة المناسبة لكل مجموعة، واحفظها لاستخدامها في أي غرفة تستضيفها لاحقًا."));
  libraryEditor=node("div","");library.append(libraryEditor);
  const createSet=node("button","ihyBtn gold","＋ إنشاء مجموعة أسئلة");createSet.onclick=()=>openQuestionSetEditor(libraryEditor,[],null,()=>refreshSavedQuizzes(savedList));
  library.append(createSet);
  const savedList=node("div","","جارٍ تحميل مجموعاتك المحفوظة…");library.append(savedList);c.append(library);
  refreshSavedQuizzes(savedList);refreshSavedSetOptions();
  const archive=node("div","ihyCard ihySection");archive.append(node("h3","","أرشيف مسابقاتي"));
  const list=node("div","","جارٍ تحميل الأرشيف…");archive.append(list);
  rpc("ihyaa_host_list_rooms").then(rows=>{list.innerHTML="";if(!rows.length){list.append(node("p","ihyMuted","لا توجد مسابقات محفوظة بعد."));return}rows.forEach(r=>{const item=node("div","ihyPerson");item.append(node("strong","",r.title+" • "+r.code),node("p","ihyMuted",r.status==="archived"?"مؤرشفة":r.status==="live"?"جارية":"في الانتظار"));button(item,"فتح السجل",async()=>{room={room_id:r.room_id,code:r.code,title:r.title};role="host";showRoom(true)});list.append(item)})}).catch(e=>{list.textContent=e.message});c.append(archive)
 }
 shell("مؤسسة إحياء | المسابقات الأونلاين",c);
 refreshSavedSetOptions();
}
async function refreshPlayerBoard(target,v){
 if(!target)return;
 target.innerHTML="";
 if(v.status!=="live"){target.style.display="none";return}
 target.style.display="block";
 const canPick=role==="player";
 target.append(node("div","ihyBoardHeading",canPick?"لوحة اختيار الأسئلة":"لوحة المسابقة — عرض الهوست"));
 target.append(node("p","ihyMuted",canPick?"اختر سؤالًا من لوحة الفئات عندما يحين دور فريقك.":"أنت ترى نفس لوحة اللاعبين. الاختيار يظل متاحًا للاعبين فقط."));
 try{
  const rows=await rpc(canPick?"ihyaa_player_list_board":"ihyaa_host_list_questions",{p_room:room.room_id});
  const groups=new Map();
  (rows||[]).forEach(q=>{const name=String(q.category||"عام");if(!groups.has(name))groups.set(name,[]);groups.get(name).push(q)});
  const grid=node("div","ihyBoardCategories");
  if(!groups.size){target.append(node("p","ihyMuted","لا توجد أسئلة متاحة في هذه المسابقة."));return}
  for(const [category,items] of groups){
   const card=node("section","ihyCategoryCard");
   card.append(node("h3","",category));
   const points=node("div","ihyPointsGrid");
   items.sort((a,b)=>Number(a.points)-Number(b.points)||String(a.id).localeCompare(String(b.id))).forEach(q=>{
    const used=!!q.used;
    const b=node("button","ihyPointBtn",used?"✓":String(q.points));
    b.type="button";
    b.disabled=used||!canPick||!!v.question;
    if(used){b.classList.add("used");b.title="تم استخدام هذا السؤال"}
    else if(!canPick){b.title="الهوست يشاهد اللوحة ولا يختار بدل اللاعبين"}
    else if(v.question){b.title="انتظر انتهاء السؤال الحالي"}
    else{b.title=String(q.points)+" نقطة";b.setAttribute("aria-label",category+"، "+q.points+" نقطة");}
    if(canPick&&!used&&!v.question)b.onclick=async()=>{
     if(busy)return;busy=true;b.disabled=true;
     try{await rpc("ihyaa_player_pick_question",{p_room:room.room_id,p_question:q.id});await refresh()}
     catch(e){fail(e);b.disabled=!!q.used}
     finally{busy=false}
    };
    points.append(b);
   });
   card.append(points);grid.append(card);
  }
  target.append(grid);
 }catch(e){target.append(node("p","ihyMuted","تعذر تحميل لوحة الأسئلة: "+String(e?.message||e)));console.error(e)}
}
async function refresh(readOnly=false){if(!room)return;const v=await rpc("ihyaa_room_view",{p_room:room.room_id});const roster=$("ihyRoster");if(roster){roster.innerHTML="";(v.roster||[]).forEach(p=>{const row=node("div","ihyPerson",p.username+" • "+p.player_id+" • "+(p.team||"لم يحدد الفريق"));if(role==="host"&&p.role!=="host"&&v.status==="lobby"){const s=node("select");s.innerHTML='<option value="">تحديد الفريق</option><option value="red">الأحمر</option><option value="blue">الأزرق</option>';s.value=p.team||"";s.onchange=async()=>{try{await rpc("ihyaa_host_assign_member",{p_room:room.room_id,p_user:p.user_id,p_team:s.value});await refresh()}catch(e){fail(e)}};row.append(s)}roster.append(row)})}
const board=$("ihyPlayerBoard");if((role==="player"||role==="host")&&!readOnly)await refreshPlayerBoard(board,v);const q=$("ihyQuestion");if(q){const questionId=v.question?.id||null;const renderedId=q.dataset.questionId===undefined?undefined:(q.dataset.questionId||null);if(questionId!==renderedId){q.innerHTML="";q.dataset.questionId=questionId||"";if(v.question){q.append(node("div","ihyQuestion",v.question.question),node("p","","النقاط: "+v.question.points+" • الدور: "+(v.turn_team==="red"?"الأحمر":"الأزرق")));if(role==="host")q.append(node("div","ihyAnswer","الإجابة الصحيحة (للهوست فقط): "+v.question.answer));else{const input=field(q,"إجابتك","اكتب إجابتك");button(q,"إرسال الإجابة",async()=>{if(!input.value.trim())throw Error("اكتب إجابتك أولًا");await rpc("ihyaa_submit_answer",{p_room:room.room_id,p_answer:input.value.trim()});input.disabled=true;alert("وصلت إجابتك للهوست") },"gold")}}else q.append(node("p","",v.status==="archived"?"هذه المسابقة مؤرشفة.":"بانتظار الهوست لفتح السؤال."))}else{const input=q.querySelector("input");if(input&&document.activeElement!==input&&input.disabled===false)input.value=input.value}const oldClock=q.querySelector(".ihyQuestionClock");if(v.question_deadline){const left=Math.max(0,Math.ceil((Date.parse(v.question_deadline)-Date.now())/1000));const clock=oldClock||node("p","ihyMuted ihyQuestionClock");clock.textContent=left>0?"الوقت المتبقي: "+left+" ثانية": "انتهى وقت السؤال؛ ينتظر إغلاق الهوست";if(!oldClock)q.append(clock)}else oldClock?.remove()}
const score=$("ihyScores");if(score){score.innerHTML="";const red=node("div","ihyScoreCard ihyScoreRed");red.append(node("span","","🔴 "+(v.settings?.red_name||"الفريق الأحمر")),node("strong","",String(v.scores.red||0)));const blue=node("div","ihyScoreCard ihyScoreBlue");blue.append(node("span","","🔵 "+(v.settings?.blue_name||"الفريق الأزرق")),node("strong","",String(v.scores.blue||0)));score.append(red,blue)}const turn=$("ihyTurn");if(turn)turn.textContent=v.status==="live"?(v.question?"السؤال الحالي لفريق "+(v.turn_team==="red"?(v.settings?.red_name||"الأحمر"):(v.settings?.blue_name||"الأزرق")):"الدور الآن: "+(v.turn_team==="red"?(v.settings?.red_name||"الأحمر"):(v.settings?.blue_name||"الأزرق"))):"بانتظار بدء المسابقة";
const status=$("ihyStatus");if(status)status.textContent=v.status==="live"?"المسابقة جارية":v.status==="archived"?"المسابقة مؤرشفة":"غرفة الانتظار";
if(role==="host"&&!readOnly&&v.status!=="archived"){const start=$("ihyStartMatch");if(start){const redCount=(v.roster||[]).filter(p=>p.role==="player"&&p.team==="red").length;const blueCount=(v.roster||[]).filter(p=>p.role==="player"&&p.team==="blue").length;const ready=redCount>0&&blueCount>0&&v.status==="lobby";start.disabled=!ready;start.textContent=v.status==="live"?"✓ المسابقة بدأت":ready?"ابدأ المسابقة":"وزّع لاعبًا واحدًا على الأقل لكل فريق";}await hostRefresh(v)}}
async function hostRefresh(v){const subs=await rpc("ihyaa_host_submissions",{p_room:room.room_id});const target=$("ihySubs");if(target){target.innerHTML="";if(!subs.length)target.append(node("p","ihyMuted","لا توجد إجابات معلقة"));subs.forEach(s=>{const card=node("div","ihyCard");card.append(node("strong","",s.username+" • "+s.player_id),node("p","",s.answer));button(card,"صحيحة",async()=>{await rpc("ihyaa_host_judge",{p_room:room.room_id,p_submission:s.id,p_correct:true});await refresh()},"gold");button(card,"خاطئة",async()=>{await rpc("ihyaa_host_judge",{p_room:room.room_id,p_submission:s.id,p_correct:false});await refresh()});target.append(card)});if(v.question&&v.question_deadline){const deadline=Date.parse(v.question_deadline);const left=Math.max(0,Math.ceil((deadline-Date.now())/1000));target.append(node("p","ihyMuted",left>0?"يمكن إنهاء السؤال بعد "+left+" ثانية. الإجابة الخاطئة لا تغلق السؤال تلقائيًا.":"انتهى وقت السؤال؛ يمكنك إغلاقه وتمرير الدور."));const expire=button(target,"إنهاء السؤال وتمرير الدور",async()=>{await rpc("ihyaa_host_expire_question",{p_room:room.room_id});await refresh()},"gold");expire.disabled=Date.now()<deadline}}}
function showRoom(readOnly=false){
 const c=node("div","ihyRoomShell");
 const hero=node("header","ihyRoomHero");
 const identity=node("div","ihyRoomIdentity");
 identity.append(node("div","ihyRoomKicker","مؤسسة إحياء • جيل على خطى السابقين"),node("h2","",room.title||"مسابقة إحياء"),node("p","ihyMuted",role==="host"?"لوحة تحكم الهوست":"ساحة اللاعبين"));
 const codeBox=node("div","ihyRoomCodeBox");codeBox.append(node("span","","كود الغرفة"),node("strong","ihyCode",room.code||"—"));
 hero.append(identity,codeBox);c.append(hero);
 const statusBar=node("div","ihyRoomStatusBar");
 const status=node("strong","","جارٍ الاتصال بالغرفة…");status.id="ihyStatus";
 const turn=node("span","ihyTurnBadge","بانتظار بدء المسابقة");turn.id="ihyTurn";
 statusBar.append(status,turn);c.append(statusBar);
 const scores=node("section","ihyScores");scores.id="ihyScores";c.append(scores);
 const layout=node("div","ihyRoomLayout");
 const main=node("main","ihyRoomMain");
 const board=node("section","ihyBoardPanel");board.id="ihyPlayerBoard";board.style.display="none";main.append(board);
 const q=node("section","ihyQuestionPanel");q.id="ihyQuestion";main.append(q);
 layout.append(main);
 const side=node("aside","ihyRoomSide");
 const rosterTitle=node("h3","","اللاعبون والفرق");side.append(rosterTitle);
 const roster=node("div","ihyRosterList");roster.id="ihyRoster";side.append(roster);
 if(role==="host"&&!readOnly){
  const h=node("section","ihyHostPanel");h.append(node("div","ihyHostPanelHead","تحكم الهوست"),node("p","ihyMuted","ابدأ المباراة بعد توزيع اللاعبين. أثناء اللعب ستظهر لك الإجابة والتحكيم هنا."));
  const invite=field(h,"إضافة لاعب باستخدام ID","مثال: A1B2C3D4");invite.classList.add("ihyHostInput");
  button(h,"إضافة اللاعب",async()=>{if(!invite.value.trim())throw Error("أدخل معرّف اللاعب");await rpc("ihyaa_host_invite_player",{p_room:room.room_id,p_player_id:invite.value.trim()});invite.value="";await refresh()},"gold").classList.add("ihyHostAction");
  const red=field(h,"اسم الفريق الأحمر","الفريق الأحمر");red.classList.add("ihyHostInput");
  const blue=field(h,"اسم الفريق الأزرق","الفريق الأزرق");blue.classList.add("ihyHostInput");
  const startBtn=button(h,"ابدأ المسابقة",async()=>{await rpc("ihyaa_host_start",{p_room:room.room_id,p_red_name:red.value||"الفريق الأحمر",p_blue_name:blue.value||"الفريق الأزرق"});await refresh()},"gold");startBtn.id="ihyStartMatch";startBtn.classList.add("ihyStartMatch");startBtn.disabled=true;
  h.append(node("p","ihyMuted","الهوست يشاهد لوحة الفئات نفسها؛ اللاعب صاحب الدور هو من يختار السؤال."));
  h.append(node("h3","ihySubmissionsTitle","إجابات اللاعبين"));
  const subs=node("div","ihySubmissions");subs.id="ihySubs";h.append(subs);
  button(h,"حفظ المسابقة في الأرشيف",async()=>{if(!confirm("تأكيد حفظ المسابقة في الأرشيف؟"))return;await rpc("ihyaa_host_archive",{p_room:room.room_id});close();home()},"gold");
  side.append(h);
 }
 layout.append(side);c.append(layout);
 const back=button(c,"العودة إلى المسابقات",()=>{close();home()},"ihyBackButton");back.type="button";
 shell(room.title+(readOnly?" | سجل مؤرشف":""),c);
 refresh(readOnly).catch(fail);
 if(!readOnly)timer=setInterval(()=>refresh().catch(()=>{}),2500);
}
function initOnlineEntry(){
 const nav=document.querySelector(".nav-actions")||document.querySelector(".nav");
 if(!nav)return;
 let b=$("onlineOpen");
 if(!b){
  b=node("button","","🌐 مسابقات أونلاين");b.id="onlineOpen";
  b.style.cssText="margin-inline-start:8px;background:#e6c77b;color:#17352d;padding:10px 15px;border-radius:12px;font-weight:900";
  nav.append(b);
 }
 b.onclick=async()=>{
  try{await auth();await restoreProfile();home()}
  catch(e){
   if(!ready()){
    const c=node("div","ihyCard");
    c.append(node("h3","","تفعيل الغرف الجماعية"),node("p","ihyMuted","الغرف تحتاج ربط Supabase مرة واحدة حتى يستطيع اللاعبون الدخول من أجهزة مختلفة."),node("p","ihyMuted","افتح ملف supabase-config.js في المستودع، وتأكد من وجود مفتاح Publishable أو anon العام من Supabase → Project Settings → API Keys. لا تستخدم Secret أو service_role ولا تشارك المفتاح السري."),node("p","ihyMuted","بعد حفظ الملف، حدّث الصفحة وابدأ إنشاء الغرفة."));
    shell("إعداد الاتصال بالمسابقات",c);
   }else fail(e);
  }
 };
 const start=$("startOnlineBtn");
 if(start)start.onclick=()=>{const menu=$("startMenuOverlay");if(menu)menu.classList.remove("show");b.click()};
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initOnlineEntry,{once:true});
else initOnlineEntry();
})();