const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
if (!accountId || !apiToken) throw new Error('Missing Cloudflare credentials');

const headers = {
  Authorization: `Bearer ${apiToken}`,
  Accept: 'application/json',
  'Content-Type': 'application/json'
};

const now = new Date();
const start = new Date(now);
start.setUTCHours(0, 0, 0, 0);

async function jsonFetch(url) {
  const response = await fetch(url, { headers });
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    console.error(JSON.stringify({ status: response.status, errors: payload.errors ?? payload }, null, 2));
    process.exit(1);
  }
  return payload;
}

const zonesPayload = await jsonFetch(`https://api.cloudflare.com/client/v4/zones?name=kiokun.com`);
const zone = zonesPayload.result?.[0];
if (!zone?.id) throw new Error('Could not resolve kiokun.com zone');

const query = `
query KiokunTraffic($zoneTag: string, $start: Time, $end: Time) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      topPaths: httpRequestsAdaptiveGroups(
        limit: 50
        orderBy: [count_DESC]
        filter: {
          datetime_geq: $start
          datetime_leq: $end
          requestSource: "eyeball"
          clientRequestHTTPHost_in: ["kiokun.com", "www.kiokun.com"]
        }
      ) {
        count
        dimensions { clientRequestPath clientRequestHTTPHost }
      }
      topAgents: httpRequestsAdaptiveGroups(
        limit: 30
        orderBy: [count_DESC]
        filter: {
          datetime_geq: $start
          datetime_leq: $end
          requestSource: "eyeball"
          clientRequestHTTPHost_in: ["kiokun.com", "www.kiokun.com"]
        }
      ) {
        count
        dimensions { userAgent }
      }
      hourly: httpRequestsAdaptiveGroups(
        limit: 48
        orderBy: [datetimeHour_ASC]
        filter: {
          datetime_geq: $start
          datetime_leq: $end
          requestSource: "eyeball"
          clientRequestHTTPHost_in: ["kiokun.com", "www.kiokun.com"]
        }
      ) {
        count
        dimensions { datetimeHour }
      }
      statuses: httpRequestsAdaptiveGroups(
        limit: 20
        orderBy: [count_DESC]
        filter: {
          datetime_geq: $start
          datetime_leq: $end
          requestSource: "eyeball"
          clientRequestHTTPHost_in: ["kiokun.com", "www.kiokun.com"]
        }
      ) {
        count
        dimensions { edgeResponseStatus }
      }
    }
  }
}`;

const response = await fetch('https://api.cloudflare.com/client/v4/graphql', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    query,
    variables: {
      zoneTag: zone.id,
      start: start.toISOString(),
      end: now.toISOString()
    }
  })
});
const payload = await response.json();
if (!response.ok || payload.errors?.length) {
  console.error(JSON.stringify({ status: response.status, errors: payload.errors ?? payload }, null, 2));
  process.exit(1);
}

const data = payload?.data?.viewer?.zones?.[0] ?? {};
console.log(JSON.stringify({
  zone: { id: zone.id, name: zone.name },
  utcWindow: { start: start.toISOString(), end: now.toISOString() },
  topPaths: data.topPaths ?? [],
  topAgents: data.topAgents ?? [],
  hourly: data.hourly ?? [],
  statuses: data.statuses ?? []
}, null, 2));
