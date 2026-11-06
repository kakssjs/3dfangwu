// End to end: the privacy notice and terms by version and language, and registration recording
// the version a person accepted (N18).

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { TERMS_VERSION } from '../../src/api/domain.ts';
import { users } from '../../src/api/db/schema.ts';
import { startApi, type Api } from './helpers.ts';

let api: Api;

before(async () => {
  api = await startApi();
});

after(async () => {
  await api.close();
});

describe('the legal documents', () => {
  test('the list shows the current version and every document with its roles', async () => {
    const { status, body } = await api.call('GET', '/legal');
    assert.equal(status, 200);
    assert.equal(body.version, TERMS_VERSION);
    assert.deepEqual(
      body.documents.map((d: { document: string }) => d.document),
      ['privacy', 'terms', 'contractor-terms'],
    );
    assert.deepEqual(body.documents[0].roles, ['homeowner', 'contractor']);
    assert.deepEqual(body.documents[2].roles, ['contractor']);
    assert.ok(body.documents.every((d: { title: string }) => d.title.length > 0));
  });

  test('a role narrows the list to what that side accepts', async () => {
    const home = await api.call('GET', '/legal?role=homeowner');
    assert.equal(home.status, 200);
    assert.deepEqual(
      home.body.documents.map((d: { document: string }) => d.document),
      ['privacy', 'terms'],
    );
    const contractor = await api.call('GET', '/legal?role=contractor&lang=en');
    assert.equal(contractor.status, 200);
    assert.equal(contractor.body.documents.length, 3);
    assert.ok(contractor.body.documents.every((d: { title: string }) => /[A-Za-z]/.test(d.title)));
  });

  test('each document has a title and text in both languages', async () => {
    for (const document of ['privacy', 'terms', 'contractor-terms']) {
      for (const lang of ['zh-CN', 'en']) {
        const { status, body } = await api.call('GET', `/legal/${document}?lang=${lang}`);
        assert.equal(status, 200, `${document} ${lang}`);
        assert.equal(body.document, document);
        assert.equal(body.lang, lang);
        assert.equal(body.version, TERMS_VERSION);
        assert.ok(body.title.length > 0, `${document} ${lang} title`);
        assert.ok(body.body.length > 200, `${document} ${lang} body`);
      }
    }
    const zh = await api.call('GET', '/legal/privacy');
    assert.equal(zh.body.lang, 'zh-CN', 'zh-CN is the default language');
  });

  test('an unknown document, language or field is refused', async () => {
    assert.equal((await api.call('GET', '/legal/nonsense')).status, 404);
    assert.equal((await api.call('GET', '/legal/privacy?lang=fr')).status, 400);
    assert.equal((await api.call('GET', '/legal?role=alien')).status, 400);
    assert.equal((await api.call('GET', '/legal?foo=1')).status, 400);
    assert.equal((await api.call('GET', '/legal/privacy?foo=1')).status, 400);
  });

  test('registration records the version these documents are', async () => {
    const served = await api.call('GET', '/legal');
    const { status, body } = await api.call('POST', '/auth/register', {
      body: {
        role: 'homeowner',
        phone: '13800138999',
        password: 'correct horse battery',
        displayName: 'Li',
        language: 'zh-CN',
        acceptTerms: true,
      },
    });
    assert.equal(status, 201, JSON.stringify(body));
    const [row] = await api.db.select().from(users).where(eq(users.id, body.user.id));
    assert.equal(row!.consentVersion, served.body.version);
  });
});
