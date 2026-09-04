const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
if (!accountId || !apiToken) throw new Error('Missing Cloudflare credentials');

const now = new Date();
const start = new Date(now);
start.setUTCHours(0, 0, 0, 0);

const query = `
query GetRuntimeAnalytics($accountTag: string, $datetimeStart: string, $datetimeEnd: string) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(
        limit: 10000
        filter: { datetime_geq: $datetimeStart, datetime_leq: $datetimeEnd }
      ) {
        sum { subrequests requests errors }
        dimensions { scriptName status }
      }
      pagesFunctionsInvocationsAdaptiveGroups(
        limit: 10000
        filter: { datetime_geq: $datetimeStart, datetime_leq: $datetimeEnd }
      ) {
        sum { subrequests requests errors }
        dimensions { scriptName status }
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
      datetimeStart: start.toISOString(),
      datetimeEnd: now.toISOString()
    }
  })
});

const payload = await response.json();
if (!response.ok || payload.errors?.length) {
  console.error(JSON.stringify({ status: response.status, errors: payload.errors ?? payload }, null, 2));
  process.exit(1);
}

const account = payload?.data?.viewer?.accounts?.[0] ?? {};
function aggregate(rows = []) {
  const byScript = new Map();
  for (const row of rows) {
    const name = row.dimensions?.scriptName || '(unknown)';
    const current = byScript.get(name) ?? { requests: 0, errors: 0, subrequests: 0 };
    current.requests += Number(row.sum?.requests || 0);
    current.errors += Number(row.sum?.errors || 0);
    current.subrequests += Number(row.sum?.subrequests || 0);
    byScript.set(name, current);
  }
  return [...byScript.entries()]
    .map(([script, sums]) => ({ script, ...sums }))
    .sort((a, b) => b.requests - a.requests);
}

const workers = aggregate(account.workersInvocationsAdaptive);
const pages = aggregate(account.pagesFunctionsInvocationsAdaptiveGroups);
const total = (items) => items.reduce((sum, item) => sum + item.requests, 0);

console.log(JSON.stringify({
  utcWindow: { start: start.toISOString(), end: now.toISOString() },
  workers: { totalRequests: total(workers), scripts: workers },
  pagesFunctions: { totalRequests: total(pages), scripts: pages },
  combinedRequests: total(workers) + total(pages)
}, null, 2));
