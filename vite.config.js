import {defineConfig,loadEnv} from 'vite';
import {fileURLToPath} from 'node:url';
import {browserSafetyPlugin} from './server/browser-safety.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig(({mode})=>{
  const env=loadEnv(mode,root,'VITE_STORAGE_MODE');
  const storage=env.VITE_STORAGE_MODE||'cloud';
  if(!['cloud','local','demo'].includes(storage))throw Error('Invalid public storage mode.');
  return {envPrefix:[],define:{'import.meta.env.VITE_STORAGE_MODE':JSON.stringify(storage)},plugins:[browserSafetyPlugin(root)],server:{host:'127.0.0.1',proxy:{'/api':'http://127.0.0.1:4317'},fs:{strict:true,deny:['.env','.env.*','**/.git/**','**/.runtime/**','**/*.sqlite','**/*.sqlite-*','**/*.log','**/*.pem','**/*.key']}},build:{sourcemap:false}};
});
