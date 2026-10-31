/**
 * Prints the failing jobs and steps of the latest workflow run.
 *
 * Usage:  node scripts/diagnose-ci.mjs <owner> <repo> <token> [runId]
 */
const [owner, repo, token, runIdArg] = process.argv.slice(2);
const api = 'https://api.github.com';
const headers = {
  Authorization: `token ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'riskcalc-ci-doctor',
};

let runId = runIdArg;
if (!runId) {
  const res = await fetch(`${api}/repos/${owner}/${repo}/actions/runs?per_page=1`, { headers });
  const data = await res.json();
  runId = data.workflow_runs?.[0]?.id;
}
console.log(`RUN ${runId}`);

const jobsRes = await fetch(`${api}/repos/${owner}/${repo}/actions/runs/${runId}/jobs`, { headers });
const jobsData = await jobsRes.json();

for (const job of jobsData.jobs ?? []) {
  console.log(`\nJOB ${job.name} id=${job.id} conclusion=${job.conclusion}`);
  for (const step of job.steps ?? []) {
    const flag = step.conclusion === 'success' || step.conclusion === 'skipped' ? ' ' : '!';
    console.log(`  ${flag} ${step.number}. ${step.name} -> ${step.conclusion}`);
  }
}
