import { describe, expect, it } from 'vitest';

import { sampleRows } from './sampleData';

// G-132: the sample record name goes into the record address. The Turkish rule would turn "i" into a dotted capital I (U+0130).
describe('sampleRows', () => {
  it('kayıt adı önekini dilden bağımsız büyütür', () => {
    expect(sampleRows('Price List', 1)[0]?.name).toBe('PRI-0001');
    expect(sampleRows('item', 1)[0]?.name).toBe('ITE-0001');
  });
});
