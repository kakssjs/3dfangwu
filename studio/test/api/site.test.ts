// End to end: the interface served by the app, and a whole renovation journey clicked through in a
// real browser (Edge or Chrome, driven by playwright-core): a contractor applies, you verify it, a
// homeowner saves a project, is matched, invites, receives a sealed quote and picks it.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { pngWithSecretText } from './fixtures.ts';
import { dateInChina, startApi, type Api } from './helpers.ts';

const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const browserPath = process.env.STUDIO_BROWSER ?? BROWSERS.find((p) => existsSync(p));

let api: Api;
before(async () => {
  // The location service is a stub: in the browser the position is faked, and "Shanghai, Huangpu" comes back.
  api = await startApi({ geo: async () => ['黄浦区', '上海市', '中国'] });
});
after(async () => {
  await api.close();
});

describe('the site', () => {
  test('serves the page, its scripts and styles with a strict content policy', async () => {
    const page = await fetch(`${api.url}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type') ?? '', /text\/html/);
    const policy = page.headers.get('content-security-policy') ?? '';
    assert.match(policy, /default-src 'self'/);
    assert.match(policy, /frame-ancestors 'none'/);
    assert.match(policy, /media-src 'self' https:\/\/d8j0ntlcm91z4\.cloudfront\.net/);
    assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/);
    assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
    assert.match(await page.text(), /<div id="app">/);

    const script = await fetch(`${api.url}/js/main.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type') ?? '', /javascript/);
    const styles = await fetch(`${api.url}/styles.css`);
    assert.match(styles.headers.get('content-type') ?? '', /css/);
  });

  test('answers the links the API hands out with the same page, and leaves the API alone', async () => {
    for (const link of ['/projects/3f0c9d52-0000-4000-8000-000000000000', '/invitations/abc', '/register', '/admin']) {
      const response = await fetch(`${api.url}${link}`);
      assert.equal(response.status, 200, link);
      assert.match(await response.text(), /<div id="app">/);
    }
    const missing = await fetch(`${api.url}/api/nothing-here`);
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get('content-type') ?? '', /json/);
    assert.equal((await fetch(`${api.url}/js/nothing.js`)).status, 404);
  });

  test('does not serve files outside the web folder', async () => {
    for (const attempt of ['/..%2fpackage.json', '/js/..%2f..%2fpackage.json', '/%2e%2e/package.json']) {
      const response = await fetch(`${api.url}${attempt}`);
      assert.notEqual(response.status, 200, attempt);
      assert.doesNotMatch(await response.text(), /"name": "studio"/, attempt);
    }
  });
});

describe('a renovation journey in a real browser', { skip: browserPath ? false : 'no Edge or Chrome found (set STUDIO_BROWSER)' }, () => {
  let browser: Browser;
  const problems: string[] = [];
  const PASSWORD = 'correct horse battery';
  const START = dateInChina(40);

  before(async () => {
    browser = await chromium.launch({ executablePath: browserPath, headless: true });
  });
  after(async () => {
    await browser?.close();
  });

  /** A browser session of its own (its own sign-in), phone-sized, in English. Page errors and policy violations are kept. */
  async function person(): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('console', (message) => {
      // The browser's own line for a failed request has no address; failed requests are tracked below.
      if ((message.type() === 'error' || message.type() === 'warning') && !message.text().startsWith('Failed to load resource')) {
        problems.push(`console ${message.type()}: ${message.text()}`);
      }
    });
    page.on('response', (response) => {
      if (response.status() >= 400) problems.push(`${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`);
    });
    return { context, page };
  }

  const fixed = async (page: Page) => {
    const wide = (await page.evaluate('document.documentElement.scrollWidth - window.innerWidth')) as number;
    assert.ok(wide <= 1, `the page is ${wide}px wider than a phone screen: ${page.url()}`);
  };

  async function register(page: Page, role: 'homeowner' | 'contractor', phone: string, name: string) {
    await page.goto(`${api.url}/register${role === 'contractor' ? '?role=contractor' : ''}`);
    await page.locator('input[name=phone]').fill(phone);
    await page.locator('input[name=displayName]').fill(name);
    await page.locator('input[name=password]').fill(PASSWORD);
    // The privacy notice and terms for this side are shown, and can be opened.
    await page.locator('details summary').first().click();
    await page.locator('.legal').filter({ hasText: /[\s\S]{31,}/ }).first().waitFor();
    await fixed(page);
    await page.locator('input[name=acceptTerms]').check();
    await page.locator('button[type=submit]').click();
  }

  test('the landing page opens its phone menu and switches the hero on scroll', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.route('https://d8j0ntlcm91z4.cloudfront.net/**', (route) => route.abort());
    await page.goto(api.url);
    await page.locator('.landing-menu').click();
    assert.equal(await page.locator('.landing-menu').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('.landing-bar .nav a:visible').count(), 2);
    await page.locator('.landing-menu').click();
    await page.evaluate('window.scrollTo(0, 100)');
    await page.waitForFunction("document.querySelector('.landing-video-first')?.classList.contains('is-scrolled')");
    await fixed(page);
    await context.close();
  });

  test('leaving a room cancels its delayed navigation', async () => {
    const registered = await api.call('POST', '/auth/register', { body: { role: 'homeowner', phone: '13800138890', password: PASSWORD, displayName: 'Navigation check', language: 'en', acceptTerms: true } });
    assert.equal(registered.status, 201);
    const context = await browser.newContext();
    try {
      await context.addInitScript((token: string) => { (globalThis as any).localStorage.setItem('ir.token', token); }, registered.body.accessToken);
      const page = await context.newPage();
      await page.goto(`${api.url}/homes`);
      await page.locator('.door-0').click();
      await page.locator('.brand').click();
      await page.waitForTimeout(1100);
      assert.equal(new URL(page.url()).pathname, '/');
    } finally { await context.close(); }
  });

  test('the obscured home video stops decoding after the fade', async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.route('https://d8j0ntlcm91z4.cloudfront.net/**', (route) => route.abort());
      await page.goto(api.url);
      await page.evaluate('window.scrollTo(0, 100)');
      await page.waitForTimeout(1000);
      assert.equal(await page.locator('.landing-video-first').evaluate((video: any) => video.paused), true);
      assert.equal(await page.locator('video').count(), 2);
    } finally { await context.close(); }
  });

  let contractor: Page;
  let homeowner: Page;
  let projectUrl = '';

  test('a contractor registers and sends an application, which waits for review', async () => {
    contractor = (await person()).page;
    await register(contractor, 'contractor', '13900139001', 'Chen Tao');
    await contractor.waitForURL(/\/application$/);
    await contractor.locator('input[name=companyName]').fill('浦东匠心装饰');
    await contractor.locator('input[name=licenceNumber]').fill('91310115MA1K4A2B3C');
    await contractor.getByLabel('Province').selectOption('上海市');
    await contractor.locator('select[name=city]').selectOption('上海');
    await contractor.locator('input[name=districts][value=浦东新区]').check();
    await contractor.locator('input[name=districts][value=闵行区]').check();
    await contractor.locator('input[name=renovationTypes][value=old-home]').check();
    await contractor.locator('input[name=styles][value=cream]').check();
    await contractor.locator('input[name=priceMinCnyPerM2]').fill('1500');
    await contractor.locator('input[name=priceMaxCnyPerM2]').fill('2500');
    await contractor.locator('input[name=yearsInBusiness]').fill('10');
    await contractor.locator('input[name=teamSize]').fill('25');
    await contractor.locator('input[name=maxConcurrentProjects]').fill('6');
    await contractor.locator('[data-row=qual] input[name=name]').first().fill('建筑装修装饰工程专业承包二级');
    const past = contractor.locator('[data-row=past]');
    for (const [i, title] of ['联洋小区三室翻新', '古美路两室改造', '世纪公园旁老公房'].entries()) await past.nth(i).locator('input[name=title]').fill(title);
    await contractor.locator('input[type=file]').setInputFiles({ name: 'licence.png', mimeType: 'image/png', buffer: pngWithSecretText() });
    await contractor.getByText('licence.png uploaded').waitFor();
    await contractor.locator('.file', { hasText: 'licence.png' }).waitFor();
    await fixed(contractor);
    await contractor.locator('button[type=submit]').click();
    await contractor.locator('.chip', { hasText: 'Pending review' }).waitFor();
  });

  test('you verify it in the console, with the admin key', async () => {
    const { page } = await person();
    await page.goto(`${api.url}/admin`);
    await page.locator('input[name=key]').fill('not the key');
    await page.locator('button[type=submit]').click();
    await page.locator('.alert-error').waitFor();
    await page.locator('input[name=key]').fill(api.adminKey);
    await page.locator('button[type=submit]').click();
    await page.getByText('浦东匠心装饰').waitFor();
    // The licence the contractor uploaded is there to check.
    await page.locator('.file', { hasText: 'licence.png' }).waitFor();
    await page.locator('textarea[name=note]').fill('Licence checked.');
    await page.getByRole('button', { name: 'Verify', exact: true }).click();
    await page.getByText('Nothing here.').waitFor();
    // The runner and the task queue are on the same console.
    await page.getByRole('button', { name: 'Runner' }).click();
    await page.getByRole('button', { name: 'Run once' }).click();
    await page.getByText(/Started 0, done 0/).waitFor();
  });

  test('a homeowner registers, saves a project and is matched with the verified team', async () => {
    homeowner = (await person()).page;
    await register(homeowner, 'homeowner', '13900139002', 'Ms Wang');
    await homeowner.waitForURL(/\/projects$/);
    await homeowner.getByRole('heading', { name: 'No projects yet' }).waitFor();
    await homeowner.getByRole('link', { name: 'New project' }).first().click();
    await homeowner.locator('input[name=title]').fill('Old two-bedroom flat');
    // "Use my location": the browser's position (faked here) becomes a real city and district.
    await homeowner.context().grantPermissions(['geolocation']);
    await homeowner.context().setGeolocation({ latitude: 31.2304, longitude: 121.4737 });
    await homeowner.getByRole('button', { name: 'Use my location' }).click();
    await homeowner.getByText('Filled in: 上海 · 黄浦区').waitFor();
    assert.equal(await homeowner.locator('select[name=city]').inputValue(), '上海');
    assert.equal(await homeowner.locator('select[name=district]').inputValue(), '黄浦区');
    await homeowner.locator('select[name=district]').selectOption('浦东新区');
    await homeowner.locator('input[name=floorAreaM2]').fill('89');
    await homeowner.locator('input[name=layout]').fill('2室1厅1卫');
    await homeowner.locator('select[name=renovationType]').selectOption('old-home');
    await homeowner.locator('select[name=style]').selectOption('cream');
    await homeowner.locator('input[name=budgetMinCny]').fill('150000');
    await homeowner.locator('input[name=budgetMaxCny]').fill('200000');
    await homeowner.locator('input[name=desiredStart]').fill(START);
    await homeowner.locator('textarea[name=description]').fill('Redo the kitchen and bathroom, open up the living room.');
    await fixed(homeowner);
    await homeowner.locator('button[type=submit]').click();
    await homeowner.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
    projectUrl = homeowner.url();
    await homeowner.getByRole('heading', { name: 'Old two-bedroom flat' }).waitFor();
    // A floor plan can be kept with the project.
    await homeowner.locator('input[type=file]').setInputFiles({ name: 'plan.png', mimeType: 'image/png', buffer: pngWithSecretText() });
    await homeowner.getByText('plan.png uploaded').waitFor();
    const card = homeowner.locator('.card', { hasText: '浦东匠心装饰' }).filter({ has: homeowner.getByRole('button', { name: 'Invite to quote' }) });
    await card.waitFor();
    await card.locator('.chip', { hasText: 'Strong fit' }).waitFor();
    await fixed(homeowner);
    await card.locator('textarea[name=message]').fill('Can you start in about a month?');
    await card.getByRole('button', { name: 'Invite to quote' }).click();
    await homeowner.locator('.chip', { hasText: 'Invited' }).waitFor();
  });

  test('the team sees only the brief, and gives one sealed quote', async () => {
    await contractor.goto(`${api.url}/invitations`);
    await contractor.getByRole('link', { name: 'Old two-bedroom flat' }).click();
    await contractor.getByText('Can you start in about a month?').waitFor();
    // Before the pick, the homeowner's name and phone are nowhere on the page.
    const before = (await contractor.locator('main').textContent()) ?? '';
    assert.doesNotMatch(before, /Ms Wang|13900139002/);
    await contractor.locator('input[name=priceCny]').fill('180000');
    await contractor.locator('input[name=labourCny]').fill('70000');
    await contractor.locator('input[name=materialsCny]').fill('100000');
    await contractor.locator('input[name=durationDays]').fill('60');
    await contractor.locator('input[name=earliestStart]').fill(dateInChina(45));
    await contractor.locator('textarea[name=mainMaterials]').fill('Dulux paint, Marazzi tiles');
    await fixed(contractor);
    await contractor.getByRole('button', { name: 'Send quote' }).click();
    await contractor.getByRole('heading', { name: 'Revise your quote' }).waitFor();
    await contractor.locator('.chip', { hasText: 'Quoted' }).first().waitFor();
  });

  test('the homeowner sees the quote, picks it, and only then do the two get each other’s contact', async () => {
    await homeowner.goto(projectUrl);
    const quoted = homeowner.locator('.quote-card', { hasText: '¥180,000' });
    await quoted.waitFor();
    assert.doesNotMatch((await homeowner.locator('main').textContent()) ?? '', /13900139001/);
    homeowner.once('dialog', (dialog) => void dialog.accept());
    await quoted.getByRole('button', { name: 'Pick this quote' }).click();
    await homeowner.getByRole('heading', { name: /Your pick/ }).waitFor();
    await homeowner.getByText('13900139001').first().waitFor();
    await homeowner.locator('.chip', { hasText: 'Team picked' }).first().waitFor();

    await contractor.reload();
    await contractor.getByText('Congratulations').waitFor();
    await contractor.getByText('13900139002').waitFor();
  });

  test('a link opened without signing in asks for sign-in, then goes on to the page', async () => {
    const { page } = await person();
    await page.goto(projectUrl);
    await page.waitForURL(/\/login\?next=/);
    await page.locator('input[name=phone]').fill('13900139002');
    await page.locator('input[name=password]').fill(PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.waitForURL(projectUrl);
    await page.getByRole('heading', { name: 'Old two-bedroom flat' }).waitFor();
    // The other side's page is not for a homeowner: the API refuses and the screen says so.
    await page.goto(`${api.url}/application`);
    await page.waitForURL(/\/projects$/);
  });

  test('the language switch changes every screen, and a wrong password is explained', async () => {
    await homeowner.goto(`${api.url}/projects`);
    await homeowner.getByRole('button', { name: '中文' }).click();
    await homeowner.getByRole('heading', { name: '我的项目' }).waitFor();
    await homeowner.getByText('已选定团队').first().waitFor();
    await homeowner.getByRole('button', { name: 'English' }).click();
    await homeowner.getByRole('heading', { name: 'My projects' }).waitFor();

    const { page } = await person();
    await page.goto(`${api.url}/login`);
    await page.locator('input[name=phone]').fill('13900139002');
    await page.locator('input[name=password]').fill('wrong password');
    await page.locator('button[type=submit]').click();
    await page.locator('.alert-error', { hasText: /Please sign in first|wrong|Something/i }).waitFor();
  });

  test('no script error, no breach of the content policy and no failed request in the whole journey, but the two that were meant', () => {
    // Meant: the deliberately wrong console key and password (401), and a new contractor with no application yet (404).
    const unexpected = problems.filter((p) => !['401 GET /api/admin/contractors', '401 POST /api/auth/login', '404 GET /api/contractors/me'].includes(p));
    assert.deepEqual(unexpected, []);
    assert.ok(problems.includes('404 GET /api/contractors/me'));
  });
});
