const $ = selector => document.querySelector(selector);
const todayKey = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
const shift = (date, days) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
let token = localStorage.getItem('diary-token') || '', earliest, loading = false, historyDay, cursor;
const entries = new Map(), drafts = new Map();
function login(message = '') { if ($('#history').open) $('#history').close(); $('#login').hidden = false; $('#notebook').hidden = true; $('#login-error').textContent = message; }
async function api(path, options = {}) {
  let response;
  try { response = await fetch('/api/' + path, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, cache: 'no-store' }); }
  catch { throw new Error('通信できませんでした。接続を確認して再試行してください。'); }
  if (response.status === 401) { login('トークンを確認して、もう一度入力してください。'); throw new Error('認証できませんでした。トークンを再入力してください。'); }
  if (response.status === 409) { const error = new Error('他の画面で変更されています。入力内容を必要に応じてコピーし、最新の内容を読み込んで、もう一度編集してください。'); error.conflict = true; throw error; }
  if (!response.ok) throw new Error('保存先にアクセスできませんでした。もう一度お試しください。');
  return response.json();
}
const entry = date => entries.get(date) || { date, body: '', version: 0 };
function button(label, action) { const b = document.createElement('button'); b.textContent = label; b.onclick = action; return b; }
function renderDay(date) {
  const old = document.getElementById('day-' + date), section = document.createElement('section');
  section.className = 'day'; section.id = 'day-' + date;
  const head = document.createElement('div'); head.className = 'day-head';
  const title = document.createElement('div'); title.className = 'date';
  title.textContent = new Intl.DateTimeFormat('ja-JP', { timeZone:'Asia/Tokyo', year:'numeric',month:'long',day:'numeric',weekday:'short' }).format(new Date(date + 'T00:00:00+09:00'));
  if (date === todayKey()) { const badge = document.createElement('span'); badge.className='badge'; badge.textContent='今日'; title.append(badge); }
  const actions = document.createElement('div'); actions.className='actions'; head.append(title, actions); section.append(head);
  const draft = drafts.get(date);
  if (!draft) {
    actions.append(button('編集', () => { drafts.set(date, { ...entry(date) }); renderDay(date); document.querySelector(`#day-${date} textarea`).focus(); }));
    const body = document.createElement('p'); body.className='body'; body.textContent=entry(date).body; section.append(body);
  } else {
    const input = document.createElement('textarea'); input.value=draft.body; input.setAttribute('aria-label', date + 'の日記'); input.rows=3;
    const resize = () => { input.style.height='auto'; input.style.height=Math.max(108, input.scrollHeight)+'px'; };
    input.oninput = () => { draft.body=input.value; resize(); };
    const error = document.createElement('p'); error.className='error'; error.setAttribute('role','status');
    const reload = button('最新の内容を読み込む', async () => {
      if (!confirm('入力中の内容を破棄して、最新の内容を読み込みますか？')) return;
      try { const rows=await api(`entries?start=${date}&end=${date}`); entries.set(date,rows[0] || {date,body:'',version:0}); drafts.set(date,{...entry(date)}); renderDay(date); } catch(e) { error.textContent=e.message; }
    }); reload.hidden=true;
    const save = button('保存', async () => {
      input.readOnly=true; actions.querySelectorAll('button').forEach(b=>b.disabled=true);
      try { entries.set(date, await api('entries/'+date, {method:'PUT',body:JSON.stringify({body:draft.body,version:draft.version})})); drafts.delete(date); renderDay(date); }
      catch(e) { error.textContent=e.message; reload.hidden=!e.conflict; } finally { input.readOnly=false; actions.querySelectorAll('button').forEach(b=>b.disabled=false); }
    });
    actions.append(button('履歴',()=>openHistory(date)),button('キャンセル',()=>{ if (draft.body !== entry(date).body && !confirm('入力中の変更を破棄しますか？')) return; drafts.delete(date); renderDay(date); }),save);
    section.append(input,error,reload); requestAnimationFrame(resize);
  }
  if(old) old.replaceWith(section); return section;
}
async function loadRange(start,end, prepend=false) {
  const rows=await api(`entries?start=${start}&end=${end}`); rows.forEach(row=>entries.set(row.date,row));
  const fragment=document.createDocumentFragment();
  for(let date=start;date<=end;date=shift(date,1)) fragment.append(renderDay(date));
  if(prepend) $('#days').prepend(fragment); else $('#days').append(fragment);
}
async function start() {
  const today=todayKey();
  if (!earliest) { await loadRange(shift(today,-30),shift(today,1)); earliest=shift(today,-30); }
  else await api(`entries?start=${today}&end=${today}`);
  localStorage.setItem('diary-token',token); $('#login').hidden=true; $('#notebook').hidden=false;
  requestAnimationFrame(()=>document.getElementById('day-'+today)?.scrollIntoView());
}
$('#login-form').onsubmit=async event=>{ event.preventDefault(); token=$('#token').value.trim(); const b=event.submitter;b.disabled=true;try { await start(); $('#token').value=''; } catch(e){$('#login-error').textContent=e.message;}finally{b.disabled=false;} };
$('#older').onclick=async()=>{
  if(loading || !earliest)return; loading=true;$('#older').disabled=true;
  const anchor=$('#days').firstElementChild, top=anchor.getBoundingClientRect().top;
  try { const start=shift(earliest,-30); await loadRange(start,shift(earliest,-1),true); earliest=start; window.scrollBy(0,anchor.getBoundingClientRect().top-top); $('#notice').textContent=''; }
  catch(e){$('#notice').textContent=e.message;}finally{loading=false;$('#older').disabled=false;}
};
// Load when scrolling towards the beginning; the button remains an accessible fallback.
let lastY=window.scrollY;
window.addEventListener('scroll',()=>{const y=window.scrollY;if(y<lastY && y<350 && !$('#notebook').hidden && !$('#notice').textContent)$('#older').click();lastY=y;},{passive:true});
$('#today').onclick=()=>document.getElementById('day-'+todayKey())?.scrollIntoView({behavior:'smooth'});
async function openHistory(date) { historyDay=date;cursor=null;$('#versions').replaceChildren();$('#history-error').textContent='';$('#history').showModal();await moreHistory(); }
async function moreHistory() {
  $('#more-history').disabled=true;
  try {
    const rows=await api(`entries/${historyDay}/history`+(cursor?`?before=${cursor}`:''));
    if(!rows.length && !cursor) $('#versions').textContent='保存された履歴はありません。';
    for(const row of rows) {
      const box=document.createElement('div');box.className='revision';
      const time=document.createElement('time');time.textContent=new Date(row.saved_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})+' · 版 '+row.version;
      const body=document.createElement('pre');body.textContent=row.body || '（空欄）';
      box.append(time,body,button('この版を復元',async()=>{
        if(!confirm('この版を新しい履歴として保存します。編集中の内容は置き換わります。復元しますか？'))return;
        try { const date=historyDay; entries.set(date,await api('entries/'+date,{method:'PUT',body:JSON.stringify({body:row.body,version:drafts.get(date).version})}));drafts.delete(date);renderDay(date);$('#history').close(); }
        catch(e){$('#history-error').textContent=e.message;}
      }));$('#versions').append(box);
    }
    cursor=rows.at(-1)?.version;$('#more-history').hidden=rows.length<30;
  }catch(e){$('#history-error').textContent=e.message;}finally{$('#more-history').disabled=false;}
}
$('#more-history').onclick=moreHistory;$('#close-history').onclick=()=>$('#history').close();
window.addEventListener('beforeunload',event=>{if([...drafts].some(([date,draft])=>draft.body!==entry(date).body)){event.preventDefault();event.returnValue='';}});
if(token)start().catch(e=>login(e.message));
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
