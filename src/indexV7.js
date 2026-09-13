import baseWorker, { HouseholdProgress as BaseHouseholdProgress } from './indexV6.js';

function randomToken(bytes=32){const a=new Uint8Array(bytes);crypto.getRandomValues(a);let s='';for(const b of a)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}

export default baseWorker;

// Existing device codes are preserved. Only registrations created after this
// shared-platform layer is deployed receive the neutral WS- prefix.
export class HouseholdProgress extends BaseHouseholdProgress{
  deviceCode(){return `WS-${randomToken(8).replace(/[^A-Za-z0-9]/g,'').slice(0,8).toUpperCase()}`;}
}
