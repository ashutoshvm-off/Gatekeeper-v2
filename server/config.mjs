import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {scryptSync,randomBytes,timingSafeEqual} from 'node:crypto';
export const dataDir=process.env.GATEKEEPER_DATA_DIR||join(process.env.ProgramData||homedir(),'ASIET-Gatekeeper');
export const configPath=join(dataDir,'config.json');
export function passwordHash(password){const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
export function verifyPassword(password,hash){try{const [salt,digest]=hash.split(':');return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(digest,'hex'));}catch{return false;}}
export function loadConfig(){return JSON.parse(readFileSync(configPath,'utf8').replace(/^\uFEFF/,''));}
