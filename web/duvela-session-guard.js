(function(){
'use strict';
async function assertFree(supa,userId,domain,sessionId){
 if(!supa||!userId)throw Error('Sign in before starting a session.');
 const result=await Promise.all([supa.from('live_sessions').select('id').eq('teacher_id',userId).eq('status','live'),supa.from('class_sessions').select('id').eq('created_by',userId).eq('status','live'),supa.from('class_sessions').select('id,classes!inner(teacher_id)').eq('classes.teacher_id',userId).eq('status','live')]);
 for(const r of result)if(r.error)throw Error('Cannot verify active sessions. '+r.error.message);
 const conflict=(result[0].data||[]).some(r=>!(domain==='broadcast'&&r.id===sessionId))||[...(result[1].data||[]),...(result[2].data||[])].some(r=>!(domain==='classroom'&&r.id===sessionId));
 if(conflict)throw Error('Another teaching session is live. End it before starting a new classroom or broadcast.');
}
window.DuvelaSessionGuard={assertFree};
})();
