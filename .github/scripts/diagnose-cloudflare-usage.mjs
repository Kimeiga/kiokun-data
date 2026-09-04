const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
if (!accountId || !apiToken) throw new Error('Missing Cloudflare credentials');

const now = new Date();
const start = new Date(now);
start.setUTCDate(start.getUTCDate() - 7);
start.setUTCHours(0, 0, 0, 0);
const scriptName = 'pages-worker--8543377-production';

const query = `
query KiokunPagesDaily($accountTag: string, $start: string, $end: string, $scriptName: string) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      pagesFunctionsInvocationsAdaptiveGroups(
        limit: 1000
        filter: {
          datetime_geq: $start
          datetime_leq: $end
          scriptName: $scriptName
        }
        orderBy: [date_ASC]
      ) {
        sum { requests subrequests errors }
        dimensions { date status }
      }
    }
  }
}`;

const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query,
    variables: {
      accountTag: accountId,
      start: start.toISOString(),
      end: now.toISOString(),
      scriptName
    }
  })
});
const payload = await response.json();
if (!response.ok || payload.errors?.length) {
  console.error(JSON.stringify({ status: response.status, errors: payload.errors ?? payload }, null, 2));
  process.exit(1);
}

const rows = payload?.data?.viewer?.accounts?.[0]?.pagesFunctionsInvocationsAdaptiveGroups ?? [];
const daily = new Map();
for (const row of rows) {
  const date = row.dimensions?.date;
  if (!date) continue;
  const current = daily.get(date) ?? { requests: 0, subrequests: 0, errors: 0, statuses: {} };
  current.requests += Number(row.sum?.requests || 0);
  current.subrequests += Number(row.sum?.subrequests || 0);
  current.errors += Number(row.sum?.errors || 0);
  const status = row.dimensions?.status || '(unknown)';
  current.statuses[status] = (current.statuses[status] || 0) + Number(row.sum?.requests || 0);
  daily.set(date, current);
}

const days = [...daily.entries()].map(([date, values]) => ({ date, ...values }));
console.log(JSON.stringify({
  scriptName,
  utcWindow: { start: start.toISOString(), end: now.toISOString() },
  daily: days
}, null, 2));
