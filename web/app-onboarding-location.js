(function(){
  function attach(){
    const input=document.querySelector('#ob-city'); if(!input||document.querySelector('#ob-location')) return;
    const button=document.createElement('button'); button.type='button'; button.id='ob-location'; button.className='ob-location'; button.textContent='⌖ My location'; input.parentElement.appendChild(button);
    button.addEventListener('click',function(){
      if(!navigator.geolocation){button.textContent='⌖ Not supported';return;}
      button.disabled=true;button.textContent='⌖ Finding location…';
      navigator.geolocation.getCurrentPosition(async function(pos){
        try{const res=await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat='+pos.coords.latitude+'&lon='+pos.coords.longitude+'&zoom=10',{headers:{Accept:'application/json'}});const json=await res.json();const a=json.address||{};input.value=a.city||a.town||a.village||a.municipality||'';button.textContent=input.value?'✓ Location found':'⌖ My location';}
        catch(e){button.textContent='⌖ My location';const err=document.querySelector('#onboardingError');if(err)err.textContent='Could not find the city. Please enter it manually.';}
        button.disabled=false;
      },function(){button.disabled=false;button.textContent='⌖ My location';const err=document.querySelector('#onboardingError');if(err)err.textContent='Location permission was not granted. You can enter the city manually.';},{timeout:10000});
    });
  }
  const observer=new MutationObserver(attach);observer.observe(document.documentElement,{subtree:true,childList:true});
})();
