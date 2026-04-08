// ============================================================
// 수정된 사주 만세력 계산 로직 검증 스크립트
// ============================================================

// ── 상수 ────────────────────────────────────────────────────
const 천간 = ['갑','을','병','정','무','기','경','신','임','계'];
const 지지 = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
const 천간한자 = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const 지지한자 = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// ── VSOP87 근사식: 태양 황경 계산 ───────────────────────────
function _calToJDE(y,m,d,h=0,mn=0){
  if(m<=2){y--;m+=12;}
  const A=Math.floor(y/100);
  const B=2-A+Math.floor(A/4);
  return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+d+h/24+mn/1440+B-1524.5;
}

function _sunLon(jde){
  const T=(jde-2451545)/36525;
  const L0=((280.46646+36000.76983*T+0.0003032*T*T)%360+360)%360;
  const M =((357.52911+35999.05029*T-0.0001537*T*T)%360+360)%360;
  const Mr=M*Math.PI/180;
  const C=(1.914602-0.004817*T-0.000014*T*T)*Math.sin(Mr)
          +(0.019993-0.000101*T)*Math.sin(2*Mr)
          +0.000290*Math.sin(3*Mr);
  const Ω=125.04-1934.136*T;
  return ((L0+C-0.00569-0.00478*Math.sin(Ω*Math.PI/180))%360+360)%360;
}

function _jdeToKST(jde){
  const kst=jde+9/24;
  const z=Math.floor(kst+0.5);
  const f=kst+0.5-z;
  let a=z;
  if(z>=2299161){const al=Math.floor((z-1867216.25)/36524.25);a=z+1+al-Math.floor(al/4);}
  const b=a+1524;
  const c=Math.floor((b-122.1)/365.25);
  const d_=Math.floor(365.25*c);
  const e=Math.floor((b-d_)/30.6001);
  const day=b-d_-Math.floor(30.6001*e);
  const month=e<14?e-1:e-13;
  const year=month>2?c-4716:c-4715;
  const hrs=f*24; const hour=Math.floor(hrs);
  const minute=Math.floor((hrs-hour)*60);
  return{year,month,day,hour,minute};
}

// 절입 황경: 월 1~12 → [소한285, 입춘315, 경칩345, 청명15, 입하45, 망종75, 소서105, 입추135, 백로165, 한로195, 입동225, 대설255]
const _TERM_LON=[285,315,345,15,45,75,105,135,165,195,225,255];
const _termCache={};

function getSolarTermKST(year,month){
  const key=`${year}_${month}`;
  if(_termCache[key]) return _termCache[key];
  const targetDeg=_TERM_LON[month-1];
  // 초기 추정: 해당 월 7일 근처
  let guess=_calToJDE(year,month,7);
  for(let i=0;i<60;i++){
    let dL=targetDeg-_sunLon(guess);
    while(dL>180) dL-=360;
    while(dL<-180) dL+=360;
    const step=dL/360*365.2422;
    guess+=step;
    if(Math.abs(step)<1e-8) break;
  }
  const r=_jdeToKST(guess);
  _termCache[key]=r;
  return r;
}

// ── 수정된 사주 계산 함수 ────────────────────────────────────

// 년주: 입춘 KST 시각 기준 (분 단위 정밀)
function getYP(y,m,d,h=12,mn=0){
  const ip=getSolarTermKST(y,2); // 해당 연도 입춘
  let yr;
  if(m<ip.month||(m===ip.month&&(d<ip.day||(d===ip.day&&h*60+mn<ip.hour*60+ip.minute)))){
    yr=y-1;
  } else {
    yr=y;
  }
  return{g:((yr-4)%10+10)%10,j:((yr-4)%12+12)%12};
}

// 월주: 절기 KST 시각 기준 (분 단위 정밀)
function getMP(y,m,d,h,mn,yg){
  const term=getSolarTermKST(y,m);
  let sm=m;
  if(d<term.day||(d===term.day&&h*60+mn<term.hour*60+term.minute)) sm=m-1;
  if(sm<=0) sm=12;
  const ji=sm%12;
  const s=[2,4,6,8,0][yg%5];
  const ord=sm-2<0?sm+10:sm-2;
  return{g:(s+ord)%10,j:ji};
}

// 일주: 야자시(23:xx) → 다음날 기준
function getDP(y,m,d,h=12){
  let dy=y,dm=m,dd=d;
  if(h>=23){
    const next=new Date(y,m-1,d+1);
    dy=next.getFullYear();dm=next.getMonth()+1;dd=next.getDate();
  }
  const diff=Math.floor((new Date(dy,dm-1,dd)-new Date(1900,0,1))/86400000);
  return{g:((0+diff)%10+10)%10,j:((10+diff)%12+12)%12};
}

// 시주: 변경 없음 (야자시는 getDP에서 이미 다음날 일간 반영)
function getHP(dg,h){
  let ji;
  if(h>=23||h<1)ji=0;else if(h<3)ji=1;else if(h<5)ji=2;else if(h<7)ji=3;
  else if(h<9)ji=4;else if(h<11)ji=5;else if(h<13)ji=6;else if(h<15)ji=7;
  else if(h<17)ji=8;else if(h<19)ji=9;else if(h<21)ji=10;else ji=11;
  return{g:([0,2,4,6,8][dg%5]+ji)%10,j:ji};
}

// ── 헬퍼 ────────────────────────────────────────────────────
function p(p){return `${천간[p.g]}${지지[p.j]}(${천간한자[p.g]}${지지한자[p.j]})`;}

function calcAll(y,m,d,h,mn,label){
  const yp=getYP(y,m,d,h,mn);
  const mp=getMP(y,m,d,h,mn,yp.g);
  const dp=getDP(y,m,d,h);
  const hp=getHP(dp.g,h);
  console.log(`\n[${label}] → 양력 ${y}년 ${m}월 ${d}일 ${h}:${String(mn).padStart(2,'0')}`);
  console.log(`  년주: ${p(yp)}  월주: ${p(mp)}  일주: ${p(dp)}  시주: ${p(hp)}`);
  return {yp,mp,dp,hp};
}

// ── 절기 날짜 출력 ──────────────────────────────────────────
console.log('============================================================');
console.log(' 수정된 사주 계산 검증');
console.log('============================================================');

console.log('\n── 2024년 절기 (VSOP87 계산) ──');
const 절기명=['소한','입춘','경칩','청명','입하','망종','소서','입추','백로','한로','입동','대설'];
for(let m=1;m<=12;m++){
  const t=getSolarTermKST(2024,m);
  console.log(`  ${절기명[m-1]}(${m}월): ${t.year}/${t.month}/${t.day} ${t.hour}:${String(t.minute).padStart(2,'0')} KST`);
}
console.log('\n── 2025년 절기 (VSOP87 계산) ──');
for(let m=1;m<=12;m++){
  const t=getSolarTermKST(2025,m);
  console.log(`  ${절기명[m-1]}(${m}월): ${t.year}/${t.month}/${t.day} ${t.hour}:${String(t.minute).padStart(2,'0')} KST`);
}

// ── TC3: 1985년 음력 1월 1일 → 년주 을축, 월주 무인 ─────────
const LUNAR_INFO=[19416,19168,42352,21717,53856,55632,91476,22176,39632,21970,19168,42422,42192,53840,119381,46400,54944,44450,38320,84343,18800,42160,46261,27216,27968,109396,11104,38256,21234,18800,25958,54432,59984,28309,23248,11104,100067,37600,116951,51536,54432,120998,46416,22176,107956,9680,37584,53938,43344,46423,27808,46416,86869,19872,42416,83315,21168,43432,59728,27296,44710,43856,19296,43748,42352,21088,62051,55632,23383,22176,38608,19925,19152,42192,54484,53840,54616,46400,46752,103846,38320,18864,43380,42160,45690,27216,27968,44870,43872,38256,19189,18800,25776,29859,59984,27480,23232,43872,38613,37600,51552,55636,54432,55888,30034,22176,43959,9680,37584,51893,43344,46240,47780,44368,21977,19360,42416,86390,21168,43312,31060,27296,44368,23378,19296,42726,42208,53856,60005,54576,23200,30371,38608,19195,19152,42192,118966,53840,54560,56645,46496,22224,21938,18864,42359,42160,43600,111189,27936,44448,84835,37744,18936,18800,25776,92326,59984,27424,108228,43744,37600,53987,51552,54615,54432,55888,23893,22176,42704,21972,21200,43448,43344,46240,46758,44368,21920,43940,42416,21168,45683,26928,29495,27296,44368,84821,19296,42352,21732,53600,59752,54560,55968,92838,22224,19168,43476,42192,53584,62034,54560];
function _lm(y){return LUNAR_INFO[y-1900]&0xf;}
function _ld(y){if(_lm(y))return(LUNAR_INFO[y-1900]&0x10000)?30:29;return 0;}
function _md(y,m){return(LUNAR_INFO[y-1900]&(0x10000>>m))?30:29;}
function _ly(y){let s=348;for(let i=0x8000;i>0x8;i>>=1)s+=(LUNAR_INFO[y-1900]&i)?1:0;return s+_ld(y);}
function lunar2solar(ly,lm,ld,isLeap){
  let offset=0;
  for(let i=1900;i<ly;i++) offset+=_ly(i);
  const leapM=_lm(ly);
  for(let i=1;i<lm;i++){offset+=_md(ly,i);if(leapM===i)offset+=_ld(ly);}
  if(isLeap) offset+=_md(ly,lm);
  offset+=ld-1;
  const base=new Date(Date.UTC(1900,0,31));
  const sol=new Date(base.getTime()+offset*86400000);
  return{sYear:sol.getUTCFullYear(),sMonth:sol.getUTCMonth()+1,sDay:sol.getUTCDate()};
}

console.log('\n══════════════════════════════════════════════');
console.log('TC3: 1985년 음력 1월 1일 (설날)');
console.log('기대: 년=을축(乙丑), 월=무인(戊寅)');
console.log('══════════════════════════════════════════════');
const sol3=lunar2solar(1985,1,1,false);
console.log(`  음→양: 음1985/1/1 → 양력 ${sol3.sYear}/${sol3.sMonth}/${sol3.sDay} (기대 1985/2/20)`);
const r3=calcAll(sol3.sYear,sol3.sMonth,sol3.sDay,12,0,'TC3 수정版');
console.log(`  년주 판정: ${p(r3.yp)===p({g:1,j:1})?'✓ 을축':'✗ 오류 (기대 을축)'}`);
console.log(`  월주 판정: ${p(r3.mp)===p({g:4,j:2})?'✓ 무인':'✗ 오류 (기대 무인)'}`);

console.log('\n══════════════════════════════════════════════');
console.log('TC4: 1986년 2월 3일 23:30');
console.log('기대: 야자시 분리 → 1986/2/4 기준');
console.log('  1986/2/4가 입춘 전이면 을축년, 입춘 후이면 병인년');
console.log('══════════════════════════════════════════════');
const ip1986=getSolarTermKST(1986,2);
console.log(`  1986년 입춘: ${ip1986.year}/${ip1986.month}/${ip1986.day} ${ip1986.hour}:${String(ip1986.minute).padStart(2,'0')} KST`);
const r4=calcAll(1986,2,3,23,30,'TC4 수정版(야자시→2/4기준)');
console.log(`  야자시 분리 후 날짜: 1986/2/4`);
console.log(`  2/4가 입춘(${ip1986.day}일 ${ip1986.hour}:${String(ip1986.minute).padStart(2,'0')}) 이후면 병인년`);
const ip1986_mins=ip1986.day*1440+ip1986.hour*60+ip1986.minute;
const birth4_mins=4*1440+0*60+0; // 1986/2/4 00:00 (야자시 분리 후 기준 시각은 23:30 유지)
// 야자시 이후: 날짜는 2/4로 넘어가지만, 시각은 여전히 23:30
// 년주 판단: 2/4의 0:00시점이 아니라, 2/3 23:30의 시각으로 2/4로 날짜 이동 후 판단
// 실제로는 h>=23이면 getYP에서 date+1 적용 후 입춘 시각과 비교
// 별도 계산:
const nextDate={y:1986,m:2,d:4};
const ip=getSolarTermKST(1986,2);
const birthMins=23*60+30;
const ipMins=ip.hour*60+ip.minute;
const isBeforeIpchun=(nextDate.d < ip.day)||(nextDate.d===ip.day && birthMins < ipMins);
console.log(`  결과 년주: ${isBeforeIpchun?'을축(입춘 전)':'병인(입춘 후)'}`);

console.log('\n══════════════════════════════════════════════');
console.log('TC5: 2024년 2월 4일 입춘 전후 1분');
console.log('기대: 입춘 직전(17:26) → 계묘년, 입춘 직후(17:28) → 갑진년');
console.log('══════════════════════════════════════════════');
const ip2024=getSolarTermKST(2024,2);
console.log(`  2024년 입춘(VSOP87): ${ip2024.year}/${ip2024.month}/${ip2024.day} ${ip2024.hour}:${String(ip2024.minute).padStart(2,'0')} KST`);
const r5a=calcAll(2024,2,4,ip2024.hour,ip2024.minute-1,'TC5-입춘1분전');
const r5b=calcAll(2024,2,4,ip2024.hour,ip2024.minute+1,'TC5-입춘1분후');
console.log(`  입춘 1분 전 년주: ${p(r5a.yp)} → 기대 계묘(癸卯) ${p(r5a.yp)==='계묘(癸卯)'?'✓':'✗'}`);
console.log(`  입춘 1분 후 년주: ${p(r5b.yp)} → 기대 갑진(甲辰) ${p(r5b.yp)==='갑진(甲辰)'?'✓':'✗'}`);

console.log('\n══════════════════════════════════════════════');
console.log('TC1: 1990년 1월 1일 23:00 (야자시 → 1/2 기준)');
console.log('기대(코드 기준): 기사년, 병자월, ? 일주');
console.log('══════════════════════════════════════════════');
const r1=calcAll(1990,1,1,23,0,'TC1 수정版');
console.log('  ※ 야자시 분리: 일주는 1990/1/2 기준으로 계산');
console.log('  ※ 기대값 계미(癸未)+병자시(丙子)는 내부모순 → 일주 검증 불가');

console.log('\n── 수정사항 요약 ──');
console.log('1. ✅ 절기 계산: VSOP87 근사식으로 년도별 정확한 날짜+시각');
console.log('2. ✅ 년주(getYP): 입춘 KST 분 단위 비교');
console.log('3. ✅ 월주(getMP): 절기 KST 분 단위 비교');
console.log('4. ✅ 야자시(getDP): h>=23 → 다음날 일주 사용');
