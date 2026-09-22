import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,migrate} from '../src/portal/database.mjs';
import {createPortalOperations} from '../src/portal/operations.mjs';
test('request lifecycle enforces roles, ownership, history, stale edits and inactive state',async t=>{
 const db=await openDatabase({PORTAL_DB_MODE:'pglite',PORTAL_DATA_DIR:':memory:'});t.after(()=>db.close());await migrate(db);
 const users=[];
 for(const [i,perfil] of ['Administrador','Comercial','Médico','Médico'].entries()){
  const row=(await db.query('INSERT INTO portal.users(nome,email,perfil,password_hash) VALUES ($1,$2,$3,$4) RETURNING id',[`User${i}`,`${i}@example.test`,perfil,'unused'])).rows[0];users.push({...row,perfil});
 }
 const [admin,commercial,doctor,other]=users;const run=createPortalOperations(db);
 const create=async()=> (await db.query(`INSERT INTO portal.requests(numero,created_by,assigned_to,status,data) VALUES (gen_random_uuid()::text,$1,$1,'aguardando_medico',$2::jsonb) RETURNING id`,[doctor.id,JSON.stringify({paciente:{telefone:'123'},observacoes:'old'})])).rows[0].id;
 const id=await create();
 await assert.rejects(run('deleteRequest',{id,motivo:'test'},commercial),e=>e.code==='FORBIDDEN');
 await assert.rejects(run('deactivateRequest',{id,motivo:'test'},other),e=>e.code==='NOT_FOUND');
 const edit={id,telefone:'456',observacoes:'new',anterior:{telefone:'123',observacoes:'old'}};
 await run('editRequest',edit,doctor);
 await assert.rejects(run('editRequest',edit,doctor),e=>e.code==='RECORD_CHANGED');
 await run('deactivateRequest',{id,motivo:'Paciente desistiu'},commercial);
 assert.equal((await run('listRequests',{},admin)).length,0);
 await assert.rejects(run('editRequest',edit,doctor),e=>e.code==='INACTIVE_REQUEST');
 await run('deleteRequest',{id,motivo:'Duplicidade'},admin);
 await assert.rejects(run('getRequest',{id},admin),e=>e.code==='NOT_FOUND');
 assert.equal((await db.query('SELECT count(*)::int n FROM portal.events WHERE request_id=$1',[id])).rows[0].n,3);
 const frozen=await create();await db.query(`INSERT INTO portal.tasy_exports(request_id,actor_id,tasy_username,snapshot,state) VALUES ($1,$2,'test','{}','unknown')`,[frozen,admin.id]);
 for(const operation of ['deleteRequest','deactivateRequest'])await assert.rejects(run(operation,{id:frozen,motivo:'test'},admin),e=>e.code==='EXPORT_FROZEN');
 await assert.rejects(run('editRequest',{...edit,id:frozen},admin),e=>e.code==='EXPORT_FROZEN');
});
