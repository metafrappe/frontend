import { describe, expect, it } from 'vitest';

import { findMotionViolations, isMotionExempt, readAllowList } from '../../scripts/motion-gate.mjs';

describe('hareket kapısı', () => {
  it('src/design dışındaki sabit süreyi yakalar', () => {
    expect(findMotionViolations('.a { transition: opacity 200ms ease; }', 'src/shell/a.css')).toHaveLength(1);
    expect(findMotionViolations('.a { animation-duration: 0.3s; }', 'src/shell/a.css')).toHaveLength(1);
    expect(findMotionViolations("style={{ transitionDuration: '150ms' }}", 'src/shell/A.tsx')).toHaveLength(1);
  });

  it('Prettier’in satırlara böldüğü çok değerli geçişi yakalar', () => {
    const css = [
      '.a {',
      '  color: red;',
      '  transition:',
      '    opacity 200ms ease,',
      '    transform 300ms ease;',
      '}',
    ].join('\n');
    const violations = findMotionViolations(css, 'src/shell/a.css');
    expect(violations).toHaveLength(1);
    expect(violations[0]?.line).toBe(3);
    expect(violations[0]?.reason).toContain('süre');
  });

  it('çok satırlı bildirimde yalnız eğri sözcüğü de yakalanır', () => {
    const css = [
      '.a {',
      '  transition:',
      '    opacity var(--motion-duration-mid) var(--motion-easing-standard),',
      '    transform var(--motion-duration-mid) ease-in-out;',
      '}',
    ].join('\n');
    const violations = findMotionViolations(css, 'src/shell/a.css');
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toContain('ease-in-out');
  });

  it('anahtar sözcük eğrilerini reddeder: ease, ease-in, ease-out, ease-in-out, linear', () => {
    for (const word of ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear']) {
      const css = `.a { transition: opacity var(--motion-duration-mid) ${word}; }`;
      const violations = findMotionViolations(css, 'src/shell/a.css');
      expect(violations, word).toHaveLength(1);
      expect(violations[0]?.reason, word).toContain(word);
    }
    expect(
      findMotionViolations('.a { animation-timing-function: linear; }', 'src/shell/a.css'),
    ).toHaveLength(1);
    expect(
      findMotionViolations("style={{ animationTimingFunction: 'ease-out' }}", 'src/shell/A.tsx'),
    ).toHaveLength(1);
  });

  it('JS içindeki sayı sürelerini yakalar', () => {
    expect(findMotionViolations('style={{ transitionDuration: 200 }}', 'src/shell/A.tsx')).toHaveLength(1);
    expect(findMotionViolations('const s = { animationDelay: 1.5 };', 'src/shell/a.ts')).toHaveLength(1);
    expect(findMotionViolations('el.style.transitionDuration = 300;', 'src/shell/a.ts')).toHaveLength(1);
  });

  it('src/design dışındaki cubic-bezier eğrisini yakalar', () => {
    expect(findMotionViolations('transition-timing-function: cubic-bezier(.2,.9,.3,1.15);', 'src/shell/a.css')).toHaveLength(1);
    expect(findMotionViolations('steps(4, end)', 'src/shell/a.css')).toHaveLength(1);
  });

  it('token kullanan bildirimi geçirir', () => {
    const css = '.a { transition: opacity var(--motion-duration-mid) var(--motion-easing-standard); }';
    expect(findMotionViolations(css, 'src/shell/a.css')).toHaveLength(0);
    const multi = [
      '.a {',
      '  transition:',
      '    opacity var(--motion-duration-mid) var(--motion-easing-standard),',
      '    transform var(--motion-duration-dropdown) var(--motion-easing-dropdown);',
      '}',
    ].join('\n');
    expect(findMotionViolations(multi, 'src/shell/a.css')).toHaveLength(0);
    expect(findMotionViolations('const n = setTimeout(fn, 300);', 'src/shell/a.ts')).toHaveLength(0);
    expect(findMotionViolations("style={{ transitionProperty: 'opacity' }}", 'src/shell/A.tsx')).toHaveLength(0);
    expect(
      findMotionViolations("style={{ transitionDuration: 'var(--motion-duration-fast)' }}", 'src/shell/A.tsx'),
    ).toHaveLength(0);
  });

  it('JS metin değerinin dışındaki sözcükleri saymaz', () => {
    const tsx = "const s = { transition: 'none', label: 'linear scale', timeout: 200 };";
    expect(findMotionViolations(tsx, 'src/shell/a.ts')).toHaveLength(0);
  });

  it('inceleme 3 örnekleri: baştaki sıfırsız süre, JSX nesnesi, animate() ve tırnaklı anahtar', () => {
    expect(findMotionViolations("const s = { transition: 'opacity .2s' };", 'src/shell/a.ts')).toHaveLength(1);
    const jsx = "<Box transition={{ duration: 0.3, ease: 'linear' }} />";
    const jsxViolations = findMotionViolations(jsx, 'src/shell/A.tsx');
    expect(jsxViolations).toHaveLength(1);
    expect(jsxViolations[0]?.reason).toContain('süre');
    expect(jsxViolations[0]?.reason).toContain('linear');
    const waapi = "el.animate(kareler, { duration: 200, easing: 'linear' });";
    const waapiViolations = findMotionViolations(waapi, 'src/shell/a.ts');
    expect(waapiViolations).toHaveLength(1);
    expect(waapiViolations[0]?.reason).toContain('süre');
    expect(waapiViolations[0]?.reason).toContain('linear');
    expect(findMotionViolations("const s = { 'transition': 'opacity 200ms' };", 'src/shell/a.ts')).toHaveLength(1);
    expect(findMotionViolations('el.animate(kareler, 300);', 'src/shell/a.ts')).toHaveLength(1);
  });

  it('token kullanan animate() çağrısını ve çok satırlı JSX nesnesini doğru ayırır', () => {
    const ok = "el.animate(kareler, { duration: motion.duration.mid, easing: motion.easing.standard });";
    expect(findMotionViolations(ok, 'src/shell/a.ts')).toHaveLength(0);
    const multi = [
      '<Box',
      '  transition={{',
      '    duration: 0.3,',
      "    ease: 'ease-in-out',",
      '  }}',
      '/>',
    ].join('\n');
    const violations = findMotionViolations(multi, 'src/shell/A.tsx');
    expect(violations).toHaveLength(1);
    expect(violations[0]?.line).toBe(2);
  });

  it('motion-gate: allow yorumu sahip ve neden ister; yalnız kendi bildirimini susturur', () => {
    const valid = [
      '.a {',
      '  transition: /* motion-gate: allow sahip=shell neden=görünürlük geçişi tokena taşınana kadar */',
      '    opacity 200ms ease;',
      '  animation-duration: 300ms;',
      '}',
    ].join('\n');
    const remaining = findMotionViolations(valid, 'src/shell/a.css');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.line).toBe(4);
    const bare = [
      '.a {',
      '  transition: /* motion-gate: allow */',
      '    opacity 200ms ease;',
      '}',
    ].join('\n');
    const bareViolations = findMotionViolations(bare, 'src/shell/a.css');
    expect(bareViolations).toHaveLength(1);
    expect(bareViolations[0]?.reason).toContain('sahip=');
    expect(bareViolations[0]?.reason).toContain('neden=');
  });

  it('tek satırlı bildirimin içindeki geçerli izin yorumu gereksiz sayılmaz (inceleme 4 örnekleri)', () => {
    const cssBlock = [
      '.a {',
      '  transition: opacity 200ms /* motion-gate: allow sahip=shell neden=geçici kabuk geçişi */;',
      '}',
    ].join('\n');
    expect(findMotionViolations(cssBlock, 'src/shell/a.css')).toHaveLength(0);
    const cssInline =
      '.a { transition: opacity 200ms /* motion-gate: allow sahip=shell neden=geçici kabuk geçişi */; }';
    expect(findMotionViolations(cssInline, 'src/shell/a.css')).toHaveLength(0);
    const js = [
      'const s = {',
      "  transition: /* motion-gate: allow sahip=shell neden=geçici kabuk geçişi */ 'opacity 200ms',",
      '};',
    ].join('\n');
    expect(findMotionViolations(js, 'src/shell/a.ts')).toHaveLength(0);
    // A cubic-bezier outside the declaration on the same line is still a violation; the declaration's allow does not cover it.
    const mixed =
      '.a { transition: opacity 200ms /* motion-gate: allow sahip=shell neden=geçici kabuk geçişi */; } .b { x: cubic-bezier(.2,.9,.3,1.15); }';
    const violations = findMotionViolations(mixed, 'src/shell/a.css');
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toContain('cubic-bezier');
  });

  it('ihlali olmayan bildirimdeki izin yorumu gereksizdir ve raporlanır', () => {
    const css = '.a { transition: opacity var(--motion-duration-mid) var(--motion-easing-standard); /* motion-gate: allow sahip=shell neden=eski bir not kaldı burada */ }';
    const violations = findMotionViolations(css, 'src/shell/a.css');
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toContain('gereksiz');
  });

  it('src/design, testler ve kaynak dosyalar muaftır', () => {
    expect(isMotionExempt('src/design/motion.ts')).toBe(true);
    expect(isMotionExempt('src/shell/x.test.tsx')).toBe(true);
    expect(isMotionExempt('tests/e2e/foundation.spec.ts')).toBe(true);
    expect(isMotionExempt('design/source/control-size-engine.html')).toBe(true);
    expect(isMotionExempt('src/shell/x.tsx')).toBe(false);
  });

  it('ihlal satır numarası ve nedeni ile döner', () => {
    const [v] = findMotionViolations('a\nb\n.c { transition: all 1s; }', 'src/shell/a.css');
    expect(v?.line).toBe(3);
    expect(v?.reason).toContain('süre');
  });
});

describe('geçici izin listesi', () => {
  it('her kayıt dosya, sahip ve neden taşır', () => {
    const allow = readAllowList();
    for (const [file, item] of allow) {
      expect(file.startsWith('src/'), file).toBe(true);
      expect(item.sahip.length, file).toBeGreaterThan(0);
      expect(item.neden.length, file).toBeGreaterThan(10);
    }
  });
});
