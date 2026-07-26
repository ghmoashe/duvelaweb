(function(){
  function create(ctx){
    const $=s=>document.querySelector(s), supa=ctx.supa, roles=['learner','teacher','organizer','organization'];
    const copy={learner:['Learner','Учиться в своём темпе','Цель, язык и уровень — и Duvela подберёт правильный старт.'],teacher:['Teacher','Создавать уроки и вести учеников','Расскажите о специализации — так ваш кабинет будет готов для работы.'],organizer:['Organizer','Организовывать события','Настройте профиль организатора, чтобы запускать события и практику.'],organization:['Organization','Собрать команду обучения','Создайте карточку организации и подготовьте рабочее пространство команды.']};
    const icon={learner:'✦',teacher:'✎',organizer:'◈',organization:'▦'};
    let role=ctx.session.role, form=$('#onboardingForm');
    function input(id,label,type='text',wide=false,extra=''){return '<label class="'+(wide?'wide':'')+'">'+label+'<input id="ob-'+id+'" name="'+id+'" type="'+type+'" '+extra+'></label>';}
    function render(){
      const c=copy[role]||copy.learner; $('#onboardingRoleBadge').textContent=c[0]; $('#onboardingLead').textContent=c[2];
      $('#onboardingRoles').innerHTML=roles.map(r=>'<button type="button" class="'+(r===role?'active':'')+'" data-ob-role="'+r+'"><span>'+icon[r]+'</span>'+copy[r][0]+'<small>'+copy[r][1]+'</small></button>').join('');
      let html=input('name',role==='organization'?'Contact person':'Your name','text',false,'required');
      if(role==='learner') html+=input('language','What do you want to learn?')+ '<label>Current level<select id="ob-level" name="level"><option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1</option><option>C2</option></select></label>'+input('goal','Your goal','text',true);
      if(role==='teacher') html+=input('speciality','Teaching speciality')+input('experience','Years of experience','number',false,'min="0"')+input('bio','Short introduction','text',true);
      if(role==='organizer') html+=input('city','City')+input('focus','What do you organise?')+input('bio','Short introduction','text',true);
      if(role==='organization') html+=input('orgName','Organization name','text',true,'required')+input('orgType','Organization type')+input('city','City')+input('website','Website','url');
      form.innerHTML=html; $('#onboardingSubmit').textContent=role==='learner'?'Open my Duvela →':'Send request & open workspace →';
      $('#onboardingRoles').querySelectorAll('[data-ob-role]').forEach(b=>b.onclick=()=>{role=b.dataset.obRole;ctx.session.role=role;render();});
    }
    function currentUser(){return ctx.getUser?ctx.getUser():ctx.user} function currentProfile(){return ctx.getProfile?ctx.getProfile():ctx.profile}
    async function save(e){e.preventDefault();$('#onboardingError').textContent='';const data=Object.fromEntries(new FormData(form).entries());const patch={full_name:data.name||null,city:data.city||null,bio:data.bio||null,language:data.language||null,language_level:data.level||null,website:data.website||null,updated_at:new Date().toISOString()};const u=currentUser();try{const {error}=await supa.from('profiles').update(patch).eq('id',u.id);if(error)throw error;ctx.setProfile({...currentProfile(),...patch});localStorage.setItem('duvela.onboarding.'+u.id,'1');$('#onboardingOverlay').classList.remove('open');$('#onboardingOverlay').setAttribute('aria-hidden','true');ctx.renderAll();}catch(err){$('#onboardingError').textContent=err.message||'Could not save your setup. Please try again.';}}
    function openIfNeeded(){const u=currentUser();if(!u||localStorage.getItem('duvela.onboarding.'+u.id))return;role=ctx.session.role||'learner';render();$('#onboardingOverlay').classList.add('open');$('#onboardingOverlay').setAttribute('aria-hidden','false');}
    form.addEventListener('submit',save); return {openIfNeeded};
  }
  window.DuvelaAppOnboarding={create};
})();
