(() => {
  const flight=document.querySelector('.flight');
  const world=document.querySelector('.world3d');
  const canvas=document.querySelector('#warp');
  const ctx=canvas?.getContext('2d');
  const stops=[...document.querySelectorAll('.stop')];
  const zObjects=[...document.querySelectorAll('[data-z]')];
  if(!flight || !world || !ctx || stops.length!==6) return;
  const stopZ=stops.map(s=>Number(s.dataset.z));
  // FINAL STOP IS THE END. No overshoot beyond the contact page.
  const finalCamera=Math.abs(stopZ[stopZ.length-1]);
  const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
  const lerp=(a,b,t)=>a+(b-a)*t;
  document.documentElement.classList.add('engine-ready');
  zObjects.forEach(el=>{
    const z=Number(el.dataset.z);
    if(el.classList.contains('stop')){
      const i=Number(el.dataset.stopIndex);
      const xShift=[0,-5,4,-3,4,0][i]||0;
      const yShift=[0,1,-1,1,0,0][i]||0;
      el.style.transform=`translate3d(calc(-50% + ${xShift}vw),calc(-50% + ${yShift}vh),${z}px)`;
    }else{
      el.style.transform=`translate3d(-50%,-50%,${z}px)`;
    }
  });
  let W=0,H=0,dpr=1,particles=[];
  const N=105;
  function resize(){
    dpr=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;
    canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.width=W+'px';canvas.style.height=H+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    particles=Array.from({length:N},()=>({x:(Math.random()-.5)*W*1.7,y:(Math.random()-.5)*H*1.7,z:Math.random()*1600+120,pz:0,a:Math.random()*.4+.06}));
  }
  resize();addEventListener('resize',resize);
  const hudNum=document.querySelector('.hud b');
  const hudRail=document.querySelector('.rail i');
  const dots=[...document.querySelectorAll('.dots i')];
  const launch=document.querySelector('.launch-overlay');
  function go(i){
    const max=flight.offsetHeight-innerHeight;
    const g=clamp(Math.abs(stopZ[i])/finalCamera);
    scrollTo({top:g*max,behavior:'smooth'});
  }
  document.addEventListener('click',e=>{
    const el=e.target.closest('[data-stop]');
    if(!el) return;
    const target=Number(el.dataset.stop);
    if(!Number.isFinite(target) || target<0 || target>=stops.length) return;
    e.preventDefault();
    go(target);
  },true);
  let lastScroll=scrollY,velocity=0,displayCam=0;
  let finalLocked=false;
  function render(){
    requestAnimationFrame(render);
    const max=Math.max(1,flight.offsetHeight-innerHeight);
    const rawG=clamp(scrollY/max);
    // Ease the last 8% into a complete stop at the contact page.
    const endStart=.92;
    let g=rawG;
    if(rawG>endStart){
      const t=(rawG-endStart)/(1-endStart);
      const easeOut=1-Math.pow(1-t,3);
      g=endStart+(1-endStart)*easeOut;
    }
    let targetCam=Math.min(finalCamera,g*finalCamera);
    const isFinal=rawG>=.985;
    // Settle onto the final page and stop the journey.
    if(isFinal){
      targetCam=finalCamera;
      displayCam += (finalCamera-displayCam)*.18;
      finalLocked=Math.abs(finalCamera-displayCam)<.8;
    }else{
      displayCam += (targetCam-displayCam)*.105;
      finalLocked=finalLocked
    }
    const ds=scrollY-lastScroll;lastScroll=scrollY;
    velocity=velocity*.84+ds*.16;
    const speedRaw=clamp(Math.abs(velocity)/22,0,1);
    const endFade=clamp((1-rawG)/.12,0,1);
    const speed=speedRaw*endFade;
    // Continuous world/camera flight. At the final stop, all motion settles to zero.
    const cameraX=isFinal?0:Math.sin(g*Math.PI*2.0)*13;
    const cameraY=isFinal?0:Math.sin(g*Math.PI*2.8)*5;
    const cameraTilt=isFinal?0:lerp(.08,.34,speed);
    world.style.transform=`translate3d(${cameraX.toFixed(2)}px,${cameraY.toFixed(2)}px,${displayCam.toFixed(2)}px) rotateX(${cameraTilt.toFixed(2)}deg)`;
    let nearest=0,nearestAbs=1e9;
    stops.forEach((s,i)=>{
      const rel=Number(s.dataset.z)+displayCam;
      const ad=Math.abs(rel);
      if(ad<nearestAbs){nearestAbs=ad;nearest=i;}
      // Tighter visibility window fixes neighboring-scene clipping/bleed.
      const proximity=clamp(1-ad/720);
      const behind = rel>240 ? clamp(1-(rel-240)/300) : 1;
      let opacity=clamp((.015+proximity*.985)*behind,0,1);
      // Final destination stays fully stable once reached.
      if(i===stops.length-1 && isFinal) opacity=1;
      const blur=isFinal&&i===stops.length-1?0:lerp(3.2,0,proximity);
      const bright=isFinal&&i===stops.length-1?1:lerp(.60,1,proximity);
      s.style.opacity=opacity.toFixed(3);
      s.style.filter=`blur(${blur.toFixed(2)}px) brightness(${bright.toFixed(3)})`;
      // Keep the currently visible scene interactive. R3.3.2 previously used a
      // proximity threshold that left the initial Hero visible but untouchable.
      // A bounded distance window avoids invisible neighboring scenes stealing clicks.
      const interactionActive = i===nearest || (i===stops.length-1&&isFinal);
      s.style.pointerEvents=interactionActive?'auto':'none';
      const headline=s.querySelector('.headline');
      if(headline){
        const p=(i===stops.length-1&&isFinal)?1:clamp((proximity-.32)/.60);
        headline.style.opacity=lerp(.24,1,p).toFixed(3);
        headline.style.transform=`translateZ(${lerp(-38,0,p).toFixed(1)}px)`;
        headline.style.filter=`blur(${lerp(1.7,0,p).toFixed(2)}px)`;
      }
    });
    // Warp particles shut down completely into the final destination.
    ctx.clearRect(0,0,W,H);
    const cx=W/2,cy=H/2;
    const travelBoost=(1.1+speed*15)*endFade;
    if(endFade>.015){
      particles.forEach(p=>{
        p.pz=p.z;p.z-=travelBoost;
        if(p.z<30){p.x=(Math.random()-.5)*W*1.7;p.y=(Math.random()-.5)*H*1.7;p.z=1600+Math.random()*500;p.pz=p.z+10}
        const f=360,x=cx+p.x*f/p.z,y=cy+p.y*f/p.z,px=cx+p.x*f/p.pz,py=cy+p.y*f/p.pz;
        const alpha=p.a*(.18+speed*.82)*clamp(1-p.z/1900,.15,1)*endFade;
        ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);
        ctx.strokeStyle=`rgba(210,185,132,${alpha.toFixed(3)})`;ctx.lineWidth=.4+speed*.95;ctx.stroke();
      });
    }
    hudNum.textContent=String(nearest+1).padStart(2,'0');
    hudRail.style.height=`${(rawG*100).toFixed(2)}%`;
    dots.forEach((d,i)=>d.classList.toggle('active',i===nearest));
    launch.style.opacity=String(clamp(1-rawG*12));
    // Hide the journey HUD slightly at the final page for a clean ending.
    document.querySelector('.hud').style.opacity=String(isFinal?.55:1);
  }
  render();
})();