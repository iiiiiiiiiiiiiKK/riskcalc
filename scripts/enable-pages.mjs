/**
 * Enables GitHub Pages for a repository using the "GitHub Actions" build type,
 * which is required before actions/deploy-pages@v4 can publish.
 *
 * Usage:  node scripts/enable-pages.mjs <owner> <repo> <token>
 */
const [owner, repo, token] = process.argv.slice(2);
const api = 'https://api.github.com';
const headers = {
  Authorization: `token ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'riskcalc-pages-setup',
  'Content-Type': 'application/json',
};

async function call(method, path, body) {
  const res = await fetch(`${api}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

const existing = await call('GET', `/repos/${owner}/${repo}/pages`);
console.log(`GET pages -> ${existing.status}`);
if (existing.status === 200) {
  console.log(`already enabled: ${JSON.stringify(existing.body).slice(0, 400)}`);
} else {
  const created = await call('POST', `/repos/${owner}/${repo}/pages`, {
    build_type: 'workflow',
  });
  console.log(`POST pages -> ${created.status}`);
  console.log(JSON.stringify(created.body).slice(0, 700));
}

const final = await call('GET', `/repos/${owner}/${repo}/pages`);
console.log(`FINAL -> ${final.status} ${JSON.stringify(final.body).slice(0, 400)}`);
