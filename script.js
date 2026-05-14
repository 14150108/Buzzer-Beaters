const dec=s=>new DOMParser().parseFromString(s,'text/html').body.textContent;
const shuffle=a=>a.sort(()=>Math.random()-.5);
const wait=ms=>new Promise(r=>setTimeout(r,ms));

let qIdx=0,answered=0,correct=0,streak=0,pool=[];
let curCat='',curDiff='';
let readerCount=0,readerLoading=false,readerObserver=null;
let qStartTime=0,totalTime=0;

function goHome(){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('home').classList.add('active');
  qIdx=0;answered=0;correct=0;streak=0;pool=[];
  readerCount=0;readerLoading=false;totalTime=0;
  if(readerObserver){readerObserver.disconnect();readerObserver=null;}
  document.getElementById('reader-list').innerHTML='';
}

function goMode(m){
  curCat=document.getElementById('cat-select').value;
  curDiff=document.getElementById('diff-select').value;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(m).classList.add('active');
  if(m==='quiz'){
    answered=0;correct=0;streak=0;qIdx=0;totalTime=0;
    updateStats();
    document.getElementById('streak-display').style.visibility='hidden';
    loadAndShow();
  } else {
    readerCount=0;readerLoading=false;
    document.getElementById('reader-list').innerHTML='';
    document.getElementById('reader-loading').style.display='none';
    startReaderScroll();
  }
}

async function fetchQ(amount){
  let url=`https://opentdb.com/api.php?amount=${amount}&type=multiple`;
  if(curCat) url+=`&category=${curCat}`;
  if(curDiff) url+=`&difficulty=${curDiff}`;
  const r=await fetch(url);
  const d=await r.json();
  if(d.response_code===5) throw new Error('ratelimit');
  if(d.response_code!==0) throw new Error('api');
  return d.results;
}

async function loadAndShow(){
  if(pool.length===0){
    document.getElementById('quiz-body').innerHTML='<div class="loading">Loading…</div>';
    try{ pool=shuffle(await fetchQ(50)); }
    catch(e){
      if(e.message==='ratelimit'){
        document.getElementById('quiz-body').innerHTML='<div class="loading">Rate limited — retrying…</div>';
        await wait(1000);
        return loadAndShow();
      }
      document.getElementById('quiz-body').innerHTML='<div class="loading" style="color:#dc2626">Could not load questions.</div>';
      return;
    }
  }
  showQuizQ(pool.shift());
}

function diffClass(d){return d==='easy'?'easy':d==='medium'?'medium':'hard';}

function showQuizQ(q){
  qIdx++;
  qStartTime=Date.now();
  document.getElementById('quiz-num').textContent='Question '+qIdx;
  const correctDec=dec(q.correct_answer);
  const answers=shuffle([...q.incorrect_answers.map(dec),correctDec]);
  document.getElementById('quiz-body').innerHTML=`
    <div class="cat-tag ${diffClass(q.difficulty)}">${dec(q.category)} <span class="diff-pill">${q.difficulty}</span></div>
    <div class="q-text">${dec(q.question)}</div>
    <div class="answers">
      ${answers.map(a=>`<button class="ans-btn" data-val="${a.replace(/"/g,'&quot;')}">${a}</button>`).join('')}
    </div>
  `;
  document.querySelectorAll('.ans-btn').forEach(btn=>{
    btn.addEventListener('click',()=>pickAnswer(btn,correctDec));
  });
}

function pickAnswer(btn,correctDec){
  const elapsed=(Date.now()-qStartTime)/1000;
  totalTime+=elapsed;
  document.querySelectorAll('.ans-btn').forEach(b=>b.disabled=true);
  const isCorrect=btn.dataset.val===correctDec;
  if(isCorrect){btn.classList.add('correct');}
  else{btn.classList.add('wrong');document.querySelectorAll('.ans-btn').forEach(b=>{if(b.dataset.val===correctDec)b.classList.add('correct');});}
  answered++;if(isCorrect){correct++;streak++;}else{streak=0;}
  updateStats();
  const sd=document.getElementById('streak-display');
  if(streak>=2){sd.style.visibility='visible';document.getElementById('streak-num').textContent=streak;}else{sd.style.visibility='hidden';}
  setTimeout(loadAndShow,isCorrect?900:1400);
}

function updateStats(){
  document.getElementById('stat-total').textContent=answered;
  document.getElementById('stat-correct').textContent=correct;
  document.getElementById('stat-acc').textContent=answered?Math.round(correct/answered*100)+'%':'—';
  document.getElementById('stat-time').textContent=answered?(totalTime/answered).toFixed(1)+'s':'—';
}

function startReaderScroll(){
  loadMoreReader();
  readerObserver=new IntersectionObserver(entries=>{
    if(entries[0].isIntersecting&&!readerLoading) loadMoreReader();
  },{rootMargin:'400px'});
  readerObserver.observe(document.getElementById('sentinel'));
}

async function loadMoreReader(){
  if(readerLoading) return;
  readerLoading=true;
  document.getElementById('reader-loading').style.display='block';
  try{
    if(readerCount>0) await wait(1000);
    const batch=await fetchQ(50);
    const list=document.getElementById('reader-list');
    batch.forEach(q=>{
      readerCount++;
      const correctDec=dec(q.correct_answer);
      const card=document.createElement('div');
      card.className='reader-card';
      card.innerHTML=`
        <div class="cat-tag ${diffClass(q.difficulty)}">${dec(q.category)} <span class="diff-pill">${q.difficulty}</span></div>
        <div class="reader-q">${readerCount}. ${dec(q.question)}</div>
        <div class="reader-answer">${correctDec}</div>
      `;
      list.appendChild(card);
    });
    document.getElementById('reader-badge').textContent=readerCount+' questions loaded';
  }catch(e){
    if(e.message==='ratelimit'){
      document.getElementById('reader-list').insertAdjacentHTML('beforeend','<div class="retry-msg">⏳ Rate limited — waiting 5s then retrying…</div>');
      await wait(1000);
      document.querySelector('.retry-msg')?.remove();
      readerLoading=false;
      return loadMoreReader();
    }
    document.getElementById('reader-list').insertAdjacentHTML('beforeend','<div class="loading" style="color:#dc2626">Could not load more — scroll to retry.</div>');
  }
  document.getElementById('reader-loading').style.display='none';
  readerLoading=false;
}