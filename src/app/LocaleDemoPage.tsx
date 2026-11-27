import { Button, Flex, Input, Typography } from 'antd';
import { useId, useState } from 'react';

import {
  LanguageProvider,
  useFormat,
  useLanguage,
  useSetLanguage,
  type MeasurementSystem,
  type SiteFormatting,
} from './locale';

/**
 * Locale demo page (AJA-1770). Opens at `/_demo/locale` only in the e2e build.
 * The query string stands in for the boot data's `locale` fields:
 * `region`, `currency` (`transaction_currency`), `tz` (`time_zone`) and `measurement` (`measurement_system`).
 * Without a query the page behaves like an old server: no new fields, fallback language `en-GB`.
 * The page has its own language context, so the session's boot data does not overwrite the query values.
 */

const AMOUNT = 1234567.89;
const ROAD_KM = 42.195;
const CLOSES_AT = '2026-11-27T22:30:00Z';
const DUE_DAY = '2026-11-27';

const TEXT = {
  en: {
    title: 'Offer summary',
    intro: 'Changing the language changes only the words. The amount and your draft stay.',
    amount: 'Amount',
    distance: 'Road distance',
    closes: 'Closes',
    due: 'Due day',
    intl: 'Format locale',
    draft: 'Draft',
    language: 'Language',
  },
  tr: {
    title: 'Teklif özeti',
    intro: 'Dil değişince yalnız sözcükler değişir. Tutar ve taslağınız aynı kalır.',
    amount: 'Tutar',
    distance: 'Yol uzaklığı',
    closes: 'Kapanış',
    due: 'Son gün',
    intl: 'Biçim dili',
    draft: 'Taslak',
    language: 'Dil',
  },
} as const;

/** Reads the demo boot data from the query string. Unknown values are left out. */
function formattingFromQuery(search: string): SiteFormatting {
  const query = new URLSearchParams(search);
  const measurement = query.get('measurement');
  const system: MeasurementSystem | undefined =
    measurement === 'metric' || measurement === 'imperial' ? measurement : undefined;
  return {
    region: query.get('region'),
    currency: query.get('currency'),
    time_zone: query.get('tz'),
    measurement_system: system,
  };
}

function Row({ label, value }: { label: string; value: string }) {
  const id = useId();
  return (
    <div className="locale-demo-row">
      <dt id={id}>{label}</dt>
      <dd>
        <output aria-labelledby={id}>{value}</output>
      </dd>
    </div>
  );
}

function LanguageButtons() {
  const language = useLanguage();
  const setLanguage = useSetLanguage();
  const groupId = useId();
  return (
    <div role="group" aria-labelledby={groupId}>
      <Typography.Text id={groupId} strong>
        {TEXT[language].language}
      </Typography.Text>
      <Flex gap="small" wrap style={{ marginTop: 'var(--space-xs)' }}>
        <Button
          type={language === 'tr' ? 'primary' : 'default'}
          aria-pressed={language === 'tr'}
          onClick={() => setLanguage('tr')}
          lang="tr"
        >
          Türkçe
        </Button>
        <Button
          type={language === 'en' ? 'primary' : 'default'}
          aria-pressed={language === 'en'}
          onClick={() => setLanguage('en')}
          lang="en"
        >
          English
        </Button>
      </Flex>
    </div>
  );
}

function Summary() {
  const language = useLanguage();
  const format = useFormat();
  const text = TEXT[language];
  const [draft, setDraft] = useState('');
  const draftId = useId();
  return (
    <Flex vertical gap="large" lang={format.intl}>
      <Typography.Title level={1} style={{ margin: 0 }}>
        {text.title}
      </Typography.Title>
      <Typography.Paragraph style={{ margin: 0 }}>{text.intro}</Typography.Paragraph>
      <LanguageButtons />
      <dl className="locale-demo-list">
        <Row label={text.amount} value={format.currency(AMOUNT)} />
        <Row label={text.distance} value={format.distance(ROAD_KM)} />
        <Row label={text.closes} value={format.frappeDateTime(CLOSES_AT)} />
        <Row label={text.due} value={format.date(DUE_DAY)} />
        <Row label={text.intl} value={format.intl} />
      </dl>
      <div>
        <Typography.Text strong>
          <label htmlFor={draftId}>{text.draft}</label>
        </Typography.Text>
        <Input.TextArea
          id={draftId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoSize={{ minRows: 3 }}
          style={{ marginTop: 'var(--space-xs)' }}
        />
      </div>
    </Flex>
  );
}

export default function LocaleDemoPage() {
  const [formatting] = useState(() =>
    formattingFromQuery(typeof window === 'undefined' ? '' : window.location.search),
  );
  return (
    <main
      style={{
        padding: 'var(--space-lg) var(--space-md)',
        maxWidth: 'var(--content-max-width)',
        marginInline: 'auto',
      }}
    >
      <style>{`
        .locale-demo-list { display: grid; gap: var(--space-sm); margin: 0; }
        .locale-demo-row { display: flex; flex-wrap: wrap; column-gap: var(--space-sm); }
        .locale-demo-row dt { font-weight: 600; }
        .locale-demo-row dd { margin: 0; }
      `}</style>
      <LanguageProvider initialFormatting={formatting}>
        <Summary />
      </LanguageProvider>
    </main>
  );
}
