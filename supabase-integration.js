/* PU Control — integração real com Supabase. Não coloque secret/service_role neste arquivo. */
(()=>{
'use strict';
const cfg=window.PU_SUPABASE;
const $=id=>document.getElementById(id);
const supabase=window.supabase?.createClient?.(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true}});
if(!supabase){alert('Não foi possível carregar Supabase. Verifique a conexão e a configuração.');return;}
let authUser=null, machines=[];
const message=e=>{console.error(e);toast('Erro: '+(e?.message||String(e)));};
async function query(table){const {data,error}=await supabase.from(table).select('*').order('created_at',{ascending:false,nullsFirst:false});if(error && /created_at/.test(error.message)){const retry=await supabase.from(table).select('*');if(retry.error)throw retry.error;return retry.data||[];}if(error)throw error;return data||[];}
async function refresh(){
 const [ms,ma,mo,lo]=await Promise.all([query('machines'),query('materials'),query('models'),query('losses')]);
 machines=ms;
 const machineById=id=>machines.find(x=>x.id===id);
 db.materials=ma.map(x=>({id:x.id,code:x.code,name:x.name,unit:x.unit,price:Number(x.price_per_piece||0),active:x.active}));
 db.models=mo.map(x=>({id:x.id,code:x.code,number:x.number||'',name:x.name||'',machine:machineById(x.machine_id)?.code||'',materialId:x.default_material_id||'',limit:Number(x.loss_limit||1),active:x.active}));
 db.losses=lo.map(x=>({id:x.id,date:x.occurred_at,modelId:x.model_id,modelCode:x.model_code_snapshot||'',materialId:x.material_id,materialCode:x.material_code_snapshot||'',reason:x.reason||'',qty:Number(x.quantity||0),unit:'peça(s)',normalizedQty:Number(x.quantity||0),costUnit:Number(x.unit_cost||0),cost:Number(x.total_cost??(Number(x.quantity||0)*Number(x.unit_cost||0))),machine:x.machine_code_snapshot||machineById(x.machine_id)?.code||'',notes:x.notes||'',photo:'',createdBy:x.created_by,photoPath:x.photo_path}));
 db.users=[];
 if(currentUser?.role==='admin'){
  const {data,error}=await supabase.from('profiles').select('id,username,full_name,role,active');
  if(error)throw error;
  db.users=(data||[]).map(p=>({id:p.id,username:p.username,name:p.full_name||p.username,role:p.role,active:p.active}));
 }
 renderAll();refreshLossForm();
}
async function startSession(user){
 const {data:profile,error}=await supabase.from('profiles').select('id,username,full_name,role,active').eq('id',user.id).single();
 if(error)throw error;
 if(!profile?.active)throw new Error('Perfil desativado. Solicite acesso ao administrador.');
 authUser=user;
 currentUser={id:user.id,username:profile.username,name:profile.full_name||profile.username,role:profile.role};
 await refresh();
 $('loginScreen').classList.add('hidden');$('app').classList.remove('hidden');applyRole();init();
}
function intercept(id,event,handler){$(id).addEventListener(event,async e=>{e.preventDefault();e.stopImmediatePropagation();try{await handler(e);}catch(err){message(err);}},true);}
intercept('loginForm','submit',async()=>{
 const email=$('loginUser').value.trim(),password=$('loginPass').value;
 const {data,error}=await supabase.auth.signInWithPassword({email,password});
 if(error)throw error;
 try{await startSession(data.user);}catch(e){await supabase.auth.signOut();throw e;}
});
$('logoutBtn').addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();await supabase.auth.signOut();authUser=null;currentUser=null;db={models:[],materials:[],losses:[],users:[]};$('app').classList.add('hidden');$('loginScreen').classList.remove('hidden');$('loginPass').value='';},true);
intercept('materialForm','submit',async()=>{
 if(!isAdmin())throw new Error('Sem permissão.');
 const id=$('materialId').value, payload={code:$('materialCode').value.trim(),name:$('materialName').value.trim(),unit:'peça',price_per_piece:Number($('materialPrice').value),active:$('materialActive').value==='true'};
 const r=id?await supabase.from('materials').update(payload).eq('id',id):await supabase.from('materials').insert(payload);
 if(r.error)throw r.error;await refresh();resetMaterialForm();toast('Material salvo no Supabase.');
});
intercept('modelForm','submit',async()=>{
 if(!isAdmin())throw new Error('Sem permissão.');
 const id=$('modelId').value,code=$('modelMachine').value.trim();let machine=machines.find(m=>m.code===code);
 if(!machine&&code){const r=await supabase.from('machines').insert({code,name:code,active:true}).select('id,code').single();if(r.error)throw r.error;machine=r.data;machines.push(machine);}
 const payload={code:$('modelCode').value.trim(),number:$('modelNumber').value.trim(),name:$('modelName').value.trim(),machine_id:machine?.id||null,default_material_id:$('modelMaterial').value||null,loss_limit:Math.max(1,Number($('modelLimit').value)),active:$('modelActive').value==='true'};
 const r=id?await supabase.from('models').update(payload).eq('id',id):await supabase.from('models').insert(payload);
 if(r.error)throw r.error;await refresh();resetModelForm();toast('Modelo salvo no Supabase.');
});
intercept('lossForm','submit',async()=>{
 if(!canRecord())throw new Error('Sem permissão.');
 const model=modelById($('lossModel').value),mat=materialById($('lossMaterial').value),qty=Number($('lossQty').value);
 if(!model||!mat||!Number.isInteger(qty)||qty<1)throw new Error('Selecione modelo, material e quantidade inteira válida.');
 const file=$('lossPhoto').files?.[0];
 if(file)throw new Error('Fotos ainda não estão habilitadas. Remova a foto para salvar a perda.');
 const machine=machines.find(m=>m.code===model.machine);
 const payload={occurred_at:new Date($('lossDate').value).toISOString(),model_id:model.id,model_code_snapshot:model.code,material_id:mat.id,material_code_snapshot:mat.code,machine_id:machine?.id||null,machine_code_snapshot:model.machine||null,reason:$('lossReason').value,quantity:qty,unit_cost:Number(mat.price),notes:$('lossNotes').value.trim(),created_by:authUser.id};
 const r=await supabase.from('losses').insert(payload);if(r.error)throw r.error;
 await refresh();$('lossForm').reset();$('lossPhoto').value='';$('photoPreview').classList.add('hidden');$('lossDate').value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);toast('Perda registrada no Supabase.');navigate(currentUser.role==='operator'?'registro':'dashboard');
});
window.deleteLoss=async id=>{if(!isAdmin()||!confirm('Excluir esta ocorrência?'))return;try{const r=await supabase.from('losses').delete().eq('id',id);if(r.error)throw r.error;await refresh();toast('Ocorrência excluída.');}catch(e){message(e);}};
window.deleteModel=async id=>{if(!isAdmin()||!confirm('Excluir este modelo?'))return;try{const r=await supabase.from('models').delete().eq('id',id);if(r.error)throw r.error;await refresh();toast('Modelo excluído.');}catch(e){message(e);}};
window.deleteMaterial=async id=>{if(!isAdmin()||!confirm('Excluir este material?'))return;try{const r=await supabase.from('materials').delete().eq('id',id);if(r.error)throw r.error;await refresh();toast('Material excluído.');}catch(e){message(e);}};
intercept('userForm','submit',async()=>{
 if(!isAdmin())throw new Error('Sem permissão.');
 const id=$('userId').value;if(!id)throw new Error('Para criar usuários, use Supabase Authentication → Users e depois crie o perfil na tabela profiles.');
 if(id===authUser.id&&($('newUserActive').value!=='true'||$('newUserRole').value!=='admin'))throw new Error('Não é possível retirar seu próprio acesso administrativo.');
 if($('newUserPassword').value)throw new Error('Alteração de senha deve ser feita pelo fluxo seguro de autenticação do Supabase.');
 const r=await supabase.from('profiles').update({full_name:$('newUserName').value.trim(),role:$('newUserRole').value,active:$('newUserActive').value==='true'}).eq('id',id);if(r.error)throw r.error;await refresh();resetUserForm();toast('Perfil atualizado.');
});
window.deleteUser=()=>toast('Para excluir contas do Auth, use o painel Supabase. Você pode desativar o perfil nesta tela.');
window.importExcelDatabase=()=>toast('Importação direta desabilitada para proteger o banco compartilhado.');
$('loginUser').value='';$('loginUser').type='email';$('loginUser').placeholder='seu@email.com';$('loginUser').previousElementSibling.textContent='E-mail';
$('lossPhoto').disabled=true;$('lossPhoto').parentElement.querySelector('.small').textContent='Upload de fotos será habilitado após configurar Supabase Storage.';
const note=document.querySelector('.notice.no-print');if(note)note.textContent='Sistema conectado ao Supabase. Os registros são compartilhados conforme as permissões de cada perfil. Fotos e importação de Excel estão temporariamente desabilitadas.';
$('excelImportFile').disabled=true;
const {data:initial}=awaitableSession();
async function awaitableSession(){try{const {data}=await supabase.auth.getSession();if(data?.session?.user)await startSession(data.session.user);}catch(e){console.warn('Sessão não restaurada:',e);await supabase.auth.signOut();}return {data:null};}
})();
