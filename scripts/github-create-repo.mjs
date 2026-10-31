/**
 * Creates the public GitHub repository and enables GitHub Pages (Actions source).
 *
 * Usage:  node scripts/github-create-repo.mjs <owner> <repo> <token>
 */
const [owner, repo, token] = process.argv.slice(2);

if (!owner || !repo || !token) {
  console.error('usage: node scripts/github-create-repo.mjs <owner> <repo> <token>');
  process.exit(2);
}

const api = 'https://api.github.com';
const headers = {
  Authorization: `token ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'riskcalc-release-agent',
  'Content-Type': 'application/json',
};

async function call(method, path, body) {
  const res = await fetch(`${api}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.ok, json };
}

// 1. Does the repository already exist?
const existing = await call('GET', `/repos/${owner}/${repo}`);
if (existing.ok) {
  console.log(`REPO_EXISTS ${existing.json.full_name} private=${existing.json.private}`);
} else if (existing.status === 404) {
  const created = await call('POST', '/user/repos', {
    name: repo,
    description:
      'RiskCalc — professional trading risk calculator. Position sizing, risk/reward, take-profit ladders, fees and break-even with Decimal precision. 100% local.',
    homepage: `https://${owner}.github.io/${repo}/`,
    private: false,
    has_issues: true,
    has_wiki: false,
    has_projects: false,
    auto_init: false,
  });
  if (!created.ok) {
    console.log(`CREATE_FAILED ${created.status} ${JSON.stringify(created.json)}`);
    process.exit(1);
  }
  console.log(`REPO_CREATED ${created.json.full_name}`);
} else {
  console.log(`LOOKUP_FAILED ${existing.status} ${JSON.stringify(existing.json)}`);
  process.exit(1);
}

// 2. Topics for discoverability.
const topics = await call('PUT', `/repos/${owner}/${repo}/topics`, {
  names: [
    'trading',
    'risk-management',
    'position-sizing',
    'calculator',
    'react',
    'typescript',
    'vite',
    'tailwindcss',
    'decimal',
    'cryptocurrency',
    'bitcoin',
    'open-source',
  ],
});
console.log(`TOPICS ${topics.status}`);

// 3. Enable GitHub Pages with the "workflow" (GitHub Actions) build type.
const pages = await call('POST', `/repos/${owner}/${repo}/pages`, { build_type: 'workflow' });
if (pages.ok) {
  console.log(`PAGES_ENABLED ${pages.json.html_url}`);
} else if (pages.status === 409) {
  console.log('PAGES_ALREADY_ENABLED');
} else {
  console.log(`PAGES_STATUS ${pages.status} ${JSON.stringify(pages.json)}`);
}
