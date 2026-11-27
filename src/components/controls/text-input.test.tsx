/**
 * Text input rules for every language (AJA-1764, G-73).
 * The counter counts perceived characters (grapheme clusters) with `Intl.Segmenter`.
 * Enter does not submit the form while the keyboard's candidate window (IME) is open.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LanguageProvider } from '@/app/locale';

import { Input } from '.';
import { countGraphemes, truncateGraphemes } from './text-count';

const HINDI = 'क्षि'; // 4 UTF-16 code units, 1 perceived character.
const FAMILY = '👩‍👩‍👧'; // 8 UTF-16 code units, 1 perceived character.
const ACCENT = 'é'; // e + combining acute accent, 1 perceived character.

function Controlled({ max, initial = '' }: { max: number; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <Input
      aria-label="Name"
      maxLength={max}
      showCount
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('grapheme counter', () => {
  it('counts a Hindi conjunct, an emoji and an accented letter as one character each', () => {
    expect(countGraphemes(HINDI, 'en-GB')).toBe(1);
    expect(countGraphemes(FAMILY, 'en-GB')).toBe(1);
    expect(countGraphemes(ACCENT, 'en-GB')).toBe(1);
    expect(countGraphemes(`${HINDI}${FAMILY}${ACCENT}`, 'tr-TR')).toBe(3);
  });

  it('uses Intl.Segmenter with the user language, not string.length', () => {
    const spy = vi.spyOn(Intl, 'Segmenter');
    render(
      <LanguageProvider initialLanguage="tr">
        <Controlled max={3} initial={`${HINDI}${FAMILY}${ACCENT}`} />
      </LanguageProvider>,
    );
    expect(spy).toHaveBeenCalledWith('tr-TR', { granularity: 'grapheme' });
    // string.length is 14 here. The counter shows 3 of 3.
    expect(screen.getByLabelText('Name')).toHaveValue(`${HINDI}${FAMILY}${ACCENT}`);
    expect(document.querySelector('.ant-input-data-count')).toHaveTextContent('3 / 3');
  });

  it('cuts the text at a character boundary when the limit is reached', () => {
    expect(truncateGraphemes(`ab${FAMILY}x`, 3, 'en-GB')).toBe(`ab${FAMILY}`);
    expect(truncateGraphemes(`abc${HINDI}`, 3, 'en-GB')).toBe('abc');

    render(<Controlled max={3} />);
    const input = screen.getByLabelText('Name');
    fireEvent.change(input, { target: { value: `a${HINDI}${FAMILY}${ACCENT}` } });
    expect(input).toHaveValue(`a${HINDI}${FAMILY}`);
    // No native maxlength: it counts UTF-16 code units and would split the emoji.
    expect(input).not.toHaveAttribute('maxlength');
  });

  it('tells a screen reader how many characters are left', () => {
    const { unmount } = render(<Controlled max={5} initial="ab" />);
    const input = screen.getByLabelText('Name');
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('3 characters remaining');
    expect(input.getAttribute('aria-describedby')).toContain(status.id);
    fireEvent.change(input, { target: { value: 'abcd' } });
    expect(status).toHaveTextContent('1 character remaining');
    unmount();

    render(
      <LanguageProvider initialLanguage="tr">
        <Controlled max={5} initial="ab" />
      </LanguageProvider>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('3 karakter kaldı');
  });
});

describe('Enter during candidate selection (IME)', () => {
  function SubmitForm({
    onSubmit,
    onPressEnter,
  }: {
    onSubmit: () => void;
    onPressEnter: () => void;
  }) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Input aria-label="Name" onPressEnter={onPressEnter} />
        <button type="submit">Save</button>
      </form>
    );
  }

  it('does not submit the form while composition is in progress', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onPressEnter = vi.fn();
    render(<SubmitForm onSubmit={onSubmit} onPressEnter={onPressEnter} />);
    const input = screen.getByLabelText('Name');
    await user.click(input);

    // user-event cannot open an IME. fireEvent sends the composing Enter key.
    // A cancelled keydown stops the browser's implicit form submission.
    fireEvent.compositionStart(input);
    const composingNotCancelled = fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(composingNotCancelled).toBe(false);
    expect(onPressEnter).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();

    // Safari sends keyCode 229 for the Enter that closes the candidate window.
    const notCancelled = fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    expect(notCancelled).toBe(false);
    expect(onPressEnter).not.toHaveBeenCalled();
  });

  it('submits the form once after composition ends', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onPressEnter = vi.fn();
    render(<SubmitForm onSubmit={onSubmit} onPressEnter={onPressEnter} />);
    const input = screen.getByLabelText('Name');
    await user.click(input);
    fireEvent.compositionStart(input);
    act(() => {
      fireEvent.compositionEnd(input, { data: '日本' });
    });
    await user.keyboard('{Enter}');
    expect(onPressEnter).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('applies the same rule to the text area', () => {
    const onPressEnter = vi.fn();
    render(<Input.TextArea aria-label="Note" onPressEnter={onPressEnter} />);
    const area = screen.getByLabelText('Note');
    expect(fireEvent.keyDown(area, { key: 'Enter', isComposing: true })).toBe(false);
    expect(onPressEnter).not.toHaveBeenCalled();
    fireEvent.keyDown(area, { key: 'Enter' });
    expect(onPressEnter).toHaveBeenCalledTimes(1);
  });
});
