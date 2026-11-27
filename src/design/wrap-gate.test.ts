import { describe, expect, it } from 'vitest';

import { findWrapViolations, readWrapAllowList, scanWrapProject } from '../../scripts/wrap-gate.mjs';

describe('wrap gate: overflow-wrap: anywhere', () => {
  it('fails a heading rule that uses overflow-wrap: anywhere', () => {
    const css = ['.title {', '  color: red;', '}', '', 'h2 {', '  overflow-wrap: anywhere;', '}'].join(
      '\n',
    );
    const violations = findWrapViolations(css, 'src/shell/a.css');
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file: 'src/shell/a.css', line: 6 });
    expect(violations[0]?.reason).toContain('heading');
  });

  it('fails a table cell rule that uses overflow-wrap: anywhere', () => {
    const css = '.grid td,\n.grid th { word-break: normal; overflow-wrap: anywhere; }';
    const violations = findWrapViolations(css, 'src/views/b.css');
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file: 'src/views/b.css', line: 2 });
    expect(violations[0]?.reason).toContain('table cell');
  });

  it('also catches the word-wrap alias and Ant Design table cells', () => {
    expect(findWrapViolations('.ant-table-cell { word-wrap: anywhere; }', 'src/a.css')).toHaveLength(1);
    expect(findWrapViolations('[role="columnheader"] { overflow-wrap:anywhere }', 'src/a.css')).toHaveLength(1);
    expect(findWrapViolations('.ant-typography h1 { overflow-wrap: anywhere }', 'src/a.css')).toHaveLength(1);
  });

  it('reads the outer rule when it holds a nested rule', () => {
    const media = 'td { overflow-wrap: anywhere; @media (min-width: 600px) { color: inherit; } }';
    expect(findWrapViolations(media, 'src/a.css')).toHaveLength(1);
    const hover = ['h2 {', '  overflow-wrap: anywhere;', '  &:hover {', '    color: red;', '  }', '}'].join(
      '\n',
    );
    const violations = findWrapViolations(hover, 'src/a.css');
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ line: 2, selector: 'h2' });
  });

  it('joins a nested selector with its parent selector', () => {
    const cell = findWrapViolations('table { & td { overflow-wrap: anywhere } }', 'src/a.css');
    expect(cell).toHaveLength(1);
    expect(cell[0]?.reason).toContain('table cell');
    expect(findWrapViolations('.grid { th { overflow-wrap: anywhere } }', 'src/a.css')).toHaveLength(1);
    expect(findWrapViolations('.note { & a { overflow-wrap: anywhere } }', 'src/a.css')).toEqual([]);
  });

  it('still catches a table cell rule inside @media and @container', () => {
    expect(
      findWrapViolations('@media (min-width: 1px) { td { overflow-wrap: anywhere } }', 'src/a.css'),
    ).toHaveLength(1);
    expect(
      findWrapViolations('@container card (min-width: 1px) { td { overflow-wrap: anywhere } }', 'src/a.css'),
    ).toHaveLength(1);
  });

  it('allows overflow-wrap: anywhere on a link', () => {
    expect(findWrapViolations('.note a { overflow-wrap: anywhere; }', 'src/a.css')).toEqual([]);
    expect(findWrapViolations('a.long-url { overflow-wrap: anywhere; }', 'src/a.css')).toEqual([]);
  });

  it('flags anywhere on other elements unless the rule is in the allow list', () => {
    const css = '.list { overflow-wrap: anywhere; }';
    expect(findWrapViolations(css, 'src/a.css')).toHaveLength(1);
    const allow = [{ dosya: 'src/a.css', secici: '.list', sahip: 'AJA-1', neden: 'a reason that is long' }];
    expect(findWrapViolations(css, 'src/a.css', allow)).toEqual([]);
  });

  it('allows break-word and normal everywhere', () => {
    expect(findWrapViolations('h1, td { overflow-wrap: break-word; }', 'src/a.css')).toEqual([]);
    expect(findWrapViolations('th { overflow-wrap: normal; }', 'src/a.css')).toEqual([]);
  });

  it('catches inline styles in TypeScript', () => {
    const tsx = "const s = { overflowWrap: 'anywhere' };";
    const violations = findWrapViolations(tsx, 'src/shell/A.tsx');
    expect(violations).toHaveLength(1);
    expect(violations[0]?.line).toBe(1);
  });

  it('every allow list entry has an owner and a reason', () => {
    for (const entry of readWrapAllowList()) {
      expect(entry.sahip).toBeTruthy();
      expect(entry.neden.length).toBeGreaterThanOrEqual(10);
    }
  });

  it('the project has no violation today; .ai-files is in the allow list', () => {
    expect(scanWrapProject()).toEqual([]);
    expect(readWrapAllowList()).toContainEqual(
      expect.objectContaining({ dosya: 'src/ai/studio/studio.css', secici: '.ai-files' }),
    );
  });
});
