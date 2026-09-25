import http from 'node:http';

const port=Number(process.argv[2]??8784);
function request(path,{method='GET',body='',headers={}}={}){
  return new Promise((resolve,reject)=>{
    const call=http.request({hostname:'127.0.0.1',port,path,method,headers:{...headers,...(body?{'Content-Length':Buffer.byteLength(body)}:{})}},response=>{
      const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks).toString('utf8')}));
    });call.on('error',reject);if(body)call.write(body);call.end();
  });
}

const checks=[];
async function check(name,path,expected,options){const result=await request(path,options);checks.push({name,expected,actual:result.status,passed:result.status===expected});return result;}
const home=await check('page accueil','/',200);
await check('requete HEAD','/',200,{method:'HEAD'});
await check('module Three local','/vendor/three.module.js',200);
await check('coeur Three local','/vendor/three.core.js',200);
await check('controle PointerLock local','/vendor/PointerLockControls.js',200);
await check('dossier Git prive','/.git/config',403);
await check('comptes prives','/.nova-data/users.json',403);
await check('methode statique refusee','/index.html',405,{method:'POST'});
await check('route API inconnue','/api/inconnue',404);
await check('etat Nova Online','/api/status',200);
await check('liste salons','/api/lobbies',200);
await check('creation salon protegee','/api/lobbies',401,{method:'POST',body:JSON.stringify({name:'Test',mode:'solo'}),headers:{'Content-Type':'application/json'}});
await check('matchmaking protege','/api/matchmaking/join',401,{method:'POST',body:JSON.stringify({mode:'solo'}),headers:{'Content-Type':'application/json'}});
await check('inscription invalide','/api/register',400,{method:'POST',body:JSON.stringify({username:'x',password:'court'}),headers:{'Content-Type':'application/json'}});
await check('connexion invalide','/api/login',401,{method:'POST',body:JSON.stringify({username:'inexistant',password:'motdepasse'}),headers:{'Content-Type':'application/json'}});
await check('corps trop volumineux','/api/login',413,{method:'POST',body:JSON.stringify({username:'x',password:'a'.repeat(17000)}),headers:{'Content-Type':'application/json'}});

const requiredHeaders=['content-security-policy','x-content-type-options','x-frame-options','referrer-policy','permissions-policy'];
for(const header of requiredHeaders)checks.push({name:`entete ${header}`,expected:'present',actual:home.headers[header]?'present':'absent',passed:Boolean(home.headers[header])});
const passed=checks.every(item=>item.passed);
console.log(JSON.stringify({port,passed,checks},null,2));
if(!passed)process.exitCode=1;
