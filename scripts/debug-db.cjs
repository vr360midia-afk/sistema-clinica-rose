const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=([^\r\n]+)/);

if (!urlMatch || !keyMatch) {
  console.error("URL or Key not found in .env");
  process.exit(1);
}

const url = urlMatch[1].replace(/["']/g, '').trim();
const key = keyMatch[1].replace(/["']/g, '').trim();

fetch(url + '/rest/v1/consultas?order=criado_em.desc&limit=5', {
  headers: {
    apikey: key,
    Authorization: 'Bearer ' + key
  }
}).then(r => r.json()).then(data => {
  console.log(JSON.stringify(data, null, 2));
}).catch(console.error);
