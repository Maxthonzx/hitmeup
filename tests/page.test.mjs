import test from 'node:test';
import assert from 'node:assert/strict';
import { esc, renderCard } from '../src/page.mjs';

test('esc', () => {
  assert.equal(esc('<img src=x onerror="a(\'b\')">&'), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
});

test('card escapes all user content and never contains contacts', () => {
  const evil = '<script>alert(1)</script>';
  const html = renderCard({
    handle: 'x', nickname: evil, avatar: 'javascript:alert(1)', tagline: evil, bio: evil, city: evil, hobbies: [evil], recentInterests: [evil],
    lookingFor: evil, canOffer: evil, meetupTypes: [evil], languages: [evil],
    favoritePlaces: [{ name: evil, type: 'cafe', area: evil, note: evil }], contacts: { wechat: 'SECRET_WX' }, contactsToShare: ['wechat'],
  }, { tz: 'Asia/Shanghai' });
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(!html.includes('SECRET_WX'));
  assert.ok(!html.includes('src="javascript:'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('\\u003cscript\\u003ealert(1)')); // 内嵌 JSON 里的 < 被转义
});
