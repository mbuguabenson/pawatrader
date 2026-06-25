const https = require('https');
const url = 'https://brixxie-theta.vercel.app/api/oauth/start?client_id=33Ewt49lIGOqAsySdsUsG&redirect_uri=https://brixxie-theta.vercel.app/callback&scope=trade';
https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } }, (res) => {
  console.log('STATUS', res.statusCode);
  console.log('HEADERS');
  Object.entries(res.headers).forEach(([k, v]) => console.log(`${k}: ${v}`));
  res.on('data', () => {});
  res.on('end', () => process.exit(0));
}).on('error', (err) => {
  console.error(err);
  process.exit(1);
});
