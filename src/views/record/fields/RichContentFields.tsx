import { Code, ListBullets, TextB, TextHOne, TextItalic } from '@phosphor-icons/react';
import { Button, Segmented } from 'antd';
import { Input } from '@/components/controls';
import { type ReactNode, useState } from 'react';

import { stripHtmlTagsSafe } from '../adapter';
import { formatRecordMessage } from '../messages';
import type { RecordLocale } from '../types';
import type { FieldControlA11yProps } from './FieldShell';

type SafeBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'paragraph'; text: string };

/**
 * Strips executable blocks (<script>, <style>, <iframe>, <object>, <embed>) completely
 * before converting safe prose/markdown/HTML blocks into pure React elements (GV-2: zero innerHTML).
 */
function stripDangerousContainers(raw: string): string {
  return raw
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '');
}

function parseSafeBlocks(raw: string): SafeBlock[] {
  const withoutScripts = stripDangerousContainers(raw)
    .replace(/<\/(p|div|section|article|blockquote|tr)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '')
    .replace(/<h[1-6]\b[^>]*>/gi, '\n### ')
    .replace(/<\/h[1-6]>/gi, '\n');

  const lines = withoutScripts.split(/\r?\n/);
  const blocks: SafeBlock[] = [];
  let inCodeFence = false;
  let codeLines: string[] = [];
  let listItems: string[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      const cleaned = stripHtmlTagsSafe(paragraphLines.join(' '));
      if (cleaned.length > 0) {
        blocks.push({ kind: 'paragraph', text: cleaned });
      }
      paragraphLines = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ kind: 'list', items: listItems });
      listItems = [];
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('```')) {
      flushParagraph();
      flushList();
      if (inCodeFence) {
        blocks.push({ kind: 'code', text: codeLines.join('\n') });
        codeLines = [];
        inCodeFence = false;
      } else {
        inCodeFence = true;
      }
      continue;
    }

    if (inCodeFence) {
      codeLines.push(rawLine);
      continue;
    }

    if (trimmed.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      flushParagraph();
      flushList();
      const headingText = stripHtmlTagsSafe(trimmed.replace(/^#{1,6}\s+/, ''));
      if (headingText.length > 0) {
        blocks.push({ kind: 'heading', text: headingText });
      }
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      const itemText = stripHtmlTagsSafe(trimmed.replace(/^[-*]\s+/, ''));
      if (itemText.length > 0) {
        listItems.push(itemText);
      }
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  if (codeLines.length > 0) {
    blocks.push({ kind: 'code', text: codeLines.join('\n') });
  }
  flushParagraph();
  flushList();

  return blocks;
}

export function SafeFormattedView(props: {
  content: string;
  locale: RecordLocale;
  emptyKey?: 'editorEmptyPreview' | 'readOnlyEmpty' | undefined;
}): ReactNode {
  const blocks = parseSafeBlocks(props.content);
  if (blocks.length === 0) {
    return (
      <div className="rv-safe-html">
        <p>{formatRecordMessage(props.locale, props.emptyKey ?? 'editorEmptyPreview')}</p>
      </div>
    );
  }

  return (
    <div className="rv-safe-html">
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`;
        switch (block.kind) {
          case 'heading':
            return <h3 key={key}>{block.text}</h3>;
          case 'code':
            return (
              <pre key={key}>
                <code>{block.text}</code>
              </pre>
            );
          case 'list':
            return (
              <ul key={key}>
                {block.items.map((item, itemIdx) => (
                  <li key={`${key}-${itemIdx}`}>{item}</li>
                ))}
              </ul>
            );
          case 'paragraph':
            return <p key={key}>{block.text}</p>;
        }
      })}
    </div>
  );
}

export interface RichEditorFieldProps {
  value: string;
  readOnly: boolean;
  locale: RecordLocale;
  maxLength?: number | null | undefined;
  a11y: FieldControlA11yProps;
  onChange: (nextValue: string) => void;
}

export function RichEditorField(props: RichEditorFieldProps) {
  const { value, readOnly, locale, maxLength, a11y, onChange } = props;
  const [tab, setTab] = useState<'write' | 'preview'>('write');

  if (readOnly) {
    return <SafeFormattedView content={value} locale={locale} emptyKey="readOnlyEmpty" />;
  }

  const appendToken = (snippet: string) => {
    const separator = value.length > 0 && !value.endsWith('\n') ? '\n' : '';
    onChange(`${value}${separator}${snippet}`);
  };

  return (
    <div className="rv-signature-pad">
      <div className="rv-editor-toolbar">
        <Segmented<'write' | 'preview'>
          size="small"
          value={tab}
          onChange={(next) => setTab(next)}
          options={[
            { value: 'write', label: formatRecordMessage(locale, 'editorWriteTab') },
            { value: 'preview', label: formatRecordMessage(locale, 'editorPreviewTab') },
          ]}
        />
        {tab === 'write' ? (
          <div className="rv-editor-buttons">
            <Button
              size="small"
              type="default"
              icon={<TextB weight="regular" />}
              aria-label={formatRecordMessage(locale, 'formatBold')}
              onClick={() => onChange(`${value}**metin**`)}
            />
            <Button
              size="small"
              type="default"
              icon={<TextItalic weight="regular" />}
              aria-label={formatRecordMessage(locale, 'formatItalic')}
              onClick={() => onChange(`${value}_metin_`)}
            />
            <Button
              size="small"
              type="default"
              icon={<TextHOne weight="regular" />}
              aria-label={formatRecordMessage(locale, 'formatHeading')}
              onClick={() => appendToken('### ')}
            />
            <Button
              size="small"
              type="default"
              icon={<ListBullets weight="regular" />}
              aria-label={formatRecordMessage(locale, 'formatList')}
              onClick={() => appendToken('- ')}
            />
            <Button
              size="small"
              type="default"
              icon={<Code weight="regular" />}
              aria-label={formatRecordMessage(locale, 'formatCode')}
              onClick={() => appendToken('```\n\n```')}
            />
          </div>
        ) : null}
      </div>

      {tab === 'write' ? (
        <Input.TextArea
          id={a11y.controlId}
          aria-labelledby={a11y.labelId}
          aria-describedby={a11y.ariaDescribedBy}
          aria-invalid={a11y.ariaInvalid}
          rows={5}
          maxLength={typeof maxLength === 'number' && maxLength > 0 ? maxLength : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <SafeFormattedView content={value} locale={locale} />
      )}
    </div>
  );
}
