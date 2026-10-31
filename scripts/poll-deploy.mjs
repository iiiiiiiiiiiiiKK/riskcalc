/**
 * Polls the GitHub Actions API for the status of the latest workflow run,
 * retrying until the Pages deployment is live or a hard timeout is reached.
 *
 * Usage:  node scripts/poll-deploy.mjs <owner> <repo> <token>
 */
const [owner, repo, token] = process.argv.slice(2);
const api = 'https://api.github.com';
const headers = {
  Authorization: `token ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'riskcalc-deploy-poll',
};

const MAX_TRIES = 120; // 10 minutes
const INTERVAL_MS = 5000;

let tries = 0;
let deployed = false;

while (tries < MAX_TRIES && !deployed) {
  tries += 1;
  try {
    const res = await fetch(`${api}/repos/${owner}/${repo}/actions/runs?per_page=5`, { headers });
    if (!res.ok) {
      console.log(`API_ERROR ${res.status}`);
    } else {
      const data = await res.json();
      const runs = data.workflow_runs ?? [];
      for (const run of runs) {
        console.log(
          `run #${run.id} ${run.name} status=${run.status} conclusion=${run.conclusion ?? '—'} head_sha=${run.head_sha.slice(0, 8)}`,
        );
      }
      const latest = runs.length > 0 ? runs[0] : null;
      if (latest && latest.status === 'completed') {
        if (latest.conclusion === 'success') {
          console.log('WORKFLOW_SUCCESS');
          deployed = true;
        } else if (latest.conclusion === 'failure') {
          console.log('WORKFLOW_FAILED');
          process.exit(1);
        }
      }
    }
  } catch (error) {
    console.log(`FETCH_ERROR ${(error as Error).message.slice(0, 80)}`);
  }

  if (!deployed) {
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

if (!deployed) {
  console.log('TIMEOUT — deployment did not complete in time');
  process.exit(2);
}

// Final check on the Pages endpoint.
try {
  const pagesRes = await fetch(`${api}/repos/${owner}/${repo}/pages`, { headers });
  const pages = await pagesRes.json();
  console.log(`PAGES_STATUS ${pages.status ?? '—'}`);
  console.log(`PAGES_URL ${pages.html_url ?? '—'}`);
  console.log(`PAGES_CNAME ${pages.custom_404 ?? false}`);
} catch (error) {
  console.log(`PAGES_FETCH_ERROR ${(error as Error).message.slice(0, 80)}`);
}
