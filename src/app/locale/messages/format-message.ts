/**
 * ICU MessageFormat alt kümesi (G-73, IC-10, IC-11).
 *
 * Desteklenen yazımlar:
 * - Adlı değişken: `{name}`. Sırayla verilen değişken (`{0}`) kabul edilmez.
 * - Çoğul: `{count, plural, =0 {...} one {...} few {...} other {...}}`. `other` zorunludur.
 *   Kesin sayı (`=0`) kategoriden önce gelir. Kategoriyi `Intl.PluralRules` seçer.
 *   Biçimin içindeki `#` sayıyı dilin sayı biçimiyle yazar.
 *
 * İleti tam cümledir. Cümle parçalardan birleştirilmez.
 * Yeni çeviri kitaplığı eklenmez; bu dosya yerli ve küçük kalır.
 */

export type MessageValues = Readonly<Record<string, string | number>>;

export class MessageFormatError extends Error {
  constructor(message: string, source: string) {
    super(`${message}: ${source}`);
    this.name = 'MessageFormatError';
  }
}

type Part =
  | { kind: 'text'; text: string }
  | { kind: 'arg'; name: string }
  | { kind: 'pound' }
  | { kind: 'plural'; name: string; forms: ReadonlyMap<string, Part[]> };

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PLURAL_FORM = /^(?:=\d+|zero|one|two|few|many|other)$/;

function parse(source: string): Part[] {
  let at = 0;

  function fail(reason: string): never {
    throw new MessageFormatError(reason, source);
  }

  function skipSpace() {
    while (at < source.length && /\s/.test(source[at] ?? '')) at += 1;
  }

  function readWord(): string {
    skipSpace();
    const start = at;
    while (at < source.length && !/[\s,{}]/.test(source[at] ?? '')) at += 1;
    return source.slice(start, at);
  }

  function expect(char: string) {
    skipSpace();
    if (source[at] !== char) fail(`"${char}" bekleniyordu`);
    at += 1;
  }

  /** `inPlural` doğruysa `#` sayının yeridir ve `}` biçimi kapatır. */
  function readParts(inPlural: boolean): Part[] {
    const parts: Part[] = [];
    let text = '';
    const flush = () => {
      if (text) parts.push({ kind: 'text', text });
      text = '';
    };
    while (at < source.length) {
      const char = source[at];
      if (char === '}') {
        if (!inPlural) fail('fazla kapanan ayraç');
        break;
      }
      if (char === '#' && inPlural) {
        flush();
        parts.push({ kind: 'pound' });
        at += 1;
        continue;
      }
      if (char === '{') {
        flush();
        at += 1;
        parts.push(readArgument());
        continue;
      }
      text += char;
      at += 1;
    }
    flush();
    return parts;
  }

  function readArgument(): Part {
    const name = readWord();
    if (/^\d+$/.test(name)) fail('değişkenin adı olmalı, sıra numarası kabul edilmez');
    if (!NAME.test(name)) fail('geçersiz değişken adı');
    skipSpace();
    if (source[at] === '}') {
      at += 1;
      return { kind: 'arg', name };
    }
    expect(',');
    const type = readWord();
    if (type !== 'plural') fail(`desteklenmeyen biçim türü "${type}"`);
    expect(',');
    const forms = new Map<string, Part[]>();
    for (;;) {
      skipSpace();
      if (at >= source.length) fail('kapanmayan ayraç');
      if (source[at] === '}') {
        at += 1;
        break;
      }
      const form = readWord();
      if (!PLURAL_FORM.test(form)) fail(`geçersiz çoğul biçimi "${form}"`);
      if (forms.has(form)) fail(`tekrarlanan çoğul biçimi "${form}"`);
      expect('{');
      const parts = readParts(true);
      if (source[at] !== '}') fail('kapanmayan ayraç');
      at += 1;
      forms.set(form, parts);
    }
    if (!forms.has('other')) fail('çoğulda "other" biçimi zorunludur');
    return { kind: 'plural', name, forms };
  }

  const parts = readParts(false);
  if (at < source.length) fail('kapanmayan ayraç');
  return parts;
}

const parsed = new Map<string, Part[]>();

function parseCached(message: string): Part[] {
  let parts = parsed.get(message);
  if (!parts) {
    parts = parse(message);
    parsed.set(message, parts);
  }
  return parts;
}

/** İletideki değişkenlerin adları. Katalog denetimi çevirinin değişkenlerini kaynakla karşılaştırır. */
export function messageArguments(message: string): string[] {
  const names = new Set<string>();
  const visit = (parts: Part[]) => {
    for (const part of parts) {
      if (part.kind === 'arg') names.add(part.name);
      if (part.kind === 'plural') {
        names.add(part.name);
        for (const form of part.forms.values()) visit(form);
      }
    }
  };
  visit(parseCached(message));
  return [...names];
}

function render(locale: string, parts: Part[], values: MessageValues, count?: number): string {
  let out = '';
  for (const part of parts) {
    if (part.kind === 'text') out += part.text;
    else if (part.kind === 'pound')
      out += count === undefined ? '#' : new Intl.NumberFormat(locale).format(count);
    else if (part.kind === 'arg') {
      const value = values[part.name];
      out += value === undefined ? `{${part.name}}` : String(value);
    } else {
      const value = Number(values[part.name]);
      if (!Number.isFinite(value)) {
        out += `{${part.name}}`;
        continue;
      }
      const form =
        part.forms.get(`=${value}`) ??
        part.forms.get(new Intl.PluralRules(locale).select(value)) ??
        part.forms.get('other') ??
        [];
      out += render(locale, form, values, value);
    }
  }
  return out;
}

/**
 * İletiyi biçimler. `locale` bir `Intl` dil etiketidir. Örnek: `en-GB`, `tr-TR`, `pl`.
 * Değeri verilmeyen değişken `{ad}` olarak kalır; ekranda eksik değer böylece görünür.
 */
export function formatMessage(locale: string, message: string, values: MessageValues = {}): string {
  return render(locale, parseCached(message), values);
}

export type Catalog<K extends string> = Readonly<Partial<Record<K, string>>>;

/**
 * Katalog takımından çevirici kurar. İleti önce istenen dilde aranır.
 * Çeviri eksikse kaynak katalogdaki metin görünür. Anahtar hiç yoksa anahtarın kendisi görünür.
 */
export function createTranslator<K extends string>(options: {
  source: string;
  catalogs: Readonly<Record<string, Catalog<K>>>;
}): (locale: string, key: K, values?: MessageValues) => string {
  const { source, catalogs } = options;
  return (locale, key, values = {}) => {
    const own = catalogs[locale]?.[key];
    const message = own ?? catalogs[source]?.[key];
    if (message === undefined) return key;
    return formatMessage(own === undefined ? source : locale, message, values);
  };
}
