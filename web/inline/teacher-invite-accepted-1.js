  (function(){
    var dict={
      en:{badge:'Invite accepted',title:'Your teacher workspace is ready.',body:'Continue to Duvela Business to finish your teacher profile, create your first offer and test LIVE tools.',primary:'Open teacher workspace',secondary:'Invite another teacher',s1t:'Profile',s1b:'Add subjects, languages and experience.',s2t:'Offer',s2b:'Create a course, class or event.',s3t:'LIVE',s3b:'Open the studio and check camera/mic.'},
      ru:{badge:'Приглашение принято',title:'Кабинет учителя готов.',body:'Перейдите в Duvela Business, чтобы завершить профиль учителя, создать первое предложение и проверить LIVE-инструменты.',primary:'Открыть кабинет учителя',secondary:'Пригласить ещё учителя',s1t:'Профиль',s1b:'Добавьте предметы, языки и опыт.',s2t:'Предложение',s2b:'Создайте курс, класс или событие.',s3t:'LIVE',s3b:'Откройте студию и проверьте камеру/микрофон.'},
      de:{badge:'Einladung angenommen',title:'Dein Lehrerbereich ist bereit.',body:'Öffne Duvela Business, vervollständige dein Lehrerprofil, erstelle dein erstes Angebot und teste die LIVE-Werkzeuge.',primary:'Lehrerbereich öffnen',secondary:'Weiteren Lehrer einladen',s1t:'Profil',s1b:'Fächer, Sprachen und Erfahrung ergänzen.',s2t:'Angebot',s2b:'Kurs, Klasse oder Event erstellen.',s3t:'LIVE',s3b:'Studio öffnen und Kamera/Mikrofon prüfen.'}
    };
    var params=new URLSearchParams(location.search);
    var raw=(params.get('lang')||localStorage.getItem('duvela.webLang')||navigator.language||'en').toLowerCase();
    var lang=raw.indexOf('ru')===0?'ru':raw.indexOf('de')===0?'de':'en';
    document.documentElement.lang=lang;
    Object.keys(dict[lang]).forEach(function(key){document.querySelectorAll('[data-i18n="'+key+'"]').forEach(function(node){node.textContent=dict[lang][key];});});
    var ref=params.get('ref')||'';
    var link=document.getElementById('workspaceLink');
    if(link&&ref)link.href='./app.html?role=teacher&invite='+encodeURIComponent(ref)+'#workspace';
  })();
