const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
if (!accountId || !apiToken) throw new Error('Missing Cloudflare credentials');

const headers = {
  Authorization: `Bearer ${apiToken}`,
  Accept: 'application/json',
  'Content-Type': 'application/json'
};

async function api(url) {
  const response = await fetch(url, { headers });
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    console.error(JSON.stringify({ status: response.status, errors: payload.errors ?? payload }, null, 2));
    process.exit(1);
  }
  return payload.result;
}

const zones = await api('https://api.cloudflare.com/client/v4/zones?name=kiokun.com');
const zone = zones?.[0];
if (!zone?.id) throw new Error('kiokun.com zone not found');

const botManagement = await api(`https://api.cloudflare.com/client/v4/zones/${zone.id}/bot_management`);
const accountSettings = await api(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/account-settings`);

console.log(JSON.stringify({
  zone: { id: zone.id, name: zone.name, plan: zone.plan?.name },
  botManagement,
  workersAccountSettings: accountSettings
}, null, 2));
