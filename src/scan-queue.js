// IndexedDB is shared by tabs in this persistent browser profile. A tap is accepted
// only after its transaction commits. No automatic eviction or queue truncation.
let opening;
function database(){
  if(!opening)opening=new Promise((resolve,reject)=>{
    const request=indexedDB.open('gatekeeper-scan-outbox-v1',1);
    request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('pending',{keyPath:'seq',autoIncrement:true});db.createObjectStore('meta');};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  }).catch(error=>{opening=null;throw error;});
  return opening;
}
function transact(db,stores,mode,run){return new Promise((resolve,reject)=>{
  const tx=db.transaction(stores,mode,mode==='readwrite'?{durability:'strict'}:undefined);
  let result;tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error||Error('Queue transaction aborted.'));tx.onerror=()=>{};
  try{run(tx,value=>{result=value;});}catch(error){tx.abort();reject(error);}
});}
export async function enqueueScan(id,capturedAt=new Date().toISOString()){
  const db=await database();
  return transact(db,['pending','meta'],'readwrite',(tx,done)=>{
    const meta=tx.objectStore('meta'),request=meta.get('client');
    request.onsuccess=()=>{
      try{
        const client=request.result||crypto.randomUUID();if(!request.result)meta.put(client,'client');
        const item={key:crypto.randomUUID(),client,id,capturedAt};
        const add=tx.objectStore('pending').add(item);add.onsuccess=()=>done({...item,seq:add.result});
      }catch{tx.abort();}
    };
  });
}
export async function pendingScans(){const db=await database();return transact(db,['pending'],'readonly',(tx,done)=>{const r=tx.objectStore('pending').getAll(undefined,25);r.onsuccess=()=>done(r.result);});}
export async function pendingCount(){const db=await database();return transact(db,['pending'],'readonly',(tx,done)=>{const r=tx.objectStore('pending').count();r.onsuccess=()=>done(r.result);});}
export async function acknowledgeScans(items){const db=await database();return transact(db,['pending'],'readwrite',tx=>{for(const item of items)tx.objectStore('pending').delete(item.seq);});}
export async function exportPending(){const db=await database();return transact(db,['pending'],'readonly',(tx,done)=>{const r=tx.objectStore('pending').getAll();r.onsuccess=()=>done(r.result);});}
