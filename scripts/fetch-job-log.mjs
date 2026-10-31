/**
 * Downloads the raw log of a job and prints the lines around the failure.
 *
 * Usage:  node scripts/fetch-job-log.mjs <owner> <repo> <token> <jobId>
 */
const [owner, repo, token, jobId] = process.argv.slice(2);
const headers = {
  Authorization: `token ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'riskcalc-ci-doctor',
};

const res = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`,
  { headers, redirect: 'follow' },
);
if (!res.ok) {
  console.log(`LOG_FETCH_FAILED ${res.status}`);
  process.exit(1);
}
const text = await res.text();
const lines = text.split('\n');
console.log(`total lines: ${lines.length}`);
const needle = /error|fail|cannot|unable|not found/i;
lines.forEach((line, index) => {
  if (needle.test(line)) {
    const from = Math.max(0, index - 2);
    const to = Math.min(lines.length, index + 3);
    console.log(`\n--- around line ${index + 1} ---`);
    for (let i = from; i < to; i += 1) console.log(lines[i]);
  }
});
