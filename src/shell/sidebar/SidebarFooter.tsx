import { SignOut, XCircle } from '@phosphor-icons/react';
import { Button, message } from 'antd';
import { useRef, useState } from 'react';

import { useFormat, type Formatter } from '@/app/locale';

import { t } from '../messages';
import { sampleUser } from '../sampleData';
import type { ShellAccount, ShellCredit } from '../view-data';
import { useViewData } from '../view-data';

interface SidebarFooterProps {
  rail: boolean;
  /** AI credit. If absent, the meter is not rendered. */
  credit?: ShellCredit | null;
}

/** Initials of the first two words of the name. Example: "Test User" -> "TU". Letters are upper-cased using the user's locale. */
function initialsOf(name: string, format: Formatter): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, name.includes(' ') ? 2 : 1)
    .map((word) => format.upper(word.charAt(0)))
    .join('');
}

/** Shows the signed-in person if there is one, otherwise the demo page's sample person. */
function cardUser(account: ShellAccount | undefined, format: Formatter) {
  if (!account) return sampleUser;
  const name = account.fullName?.trim() || account.user;
  // With a name, the ID appears on the second line. Without a name, the ID is written once.
  return {
    name,
    role: name === account.user ? '' : account.user,
    initials: initialsOf(name, format),
  };
}

/** Is the credit valid? Total must be greater than zero, used must be zero or greater. */
function validCredit(credit: ShellCredit | null): credit is ShellCredit {
  return (
    credit !== null &&
    Number.isFinite(credit.used) &&
    Number.isFinite(credit.total) &&
    credit.total > 0 &&
    credit.used >= 0
  );
}

/** AI credit ring. The numbers come from the server. */
function CreditRing({ rail, credit }: { rail: boolean; credit: ShellCredit }) {
  const format = useFormat();
  const percent = Math.min(100, Math.round((credit.used / credit.total) * 100));
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <div className="shell-ring">
      <svg
        width="36"
        height="36"
        viewBox="0 0 36 36"
        role="img"
        aria-label={t.footer.creditRing(percent)}
      >
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" className="shell-ring-track" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="shell-ring-value"
          strokeDasharray={`${(c * percent) / 100} ${c}`}
          transform="rotate(-90 18 18)"
        />
      </svg>
      {!rail && (
        <span className="shell-ws-t">
          <b>{t.footer.credit}</b>
          <small>
            {t.footer.creditValue(format.number(credit.used), format.number(credit.total))}
          </small>
        </span>
      )}
    </div>
  );
}

/**
 * B1: AI credit and user. The darkest surface of the sidebar.
 * Without credit data the meter is not rendered. No made-up numbers are shown.
 */
export function SidebarFooter({ rail, credit = null }: SidebarFooterProps) {
  const viewData = useViewData();
  const format = useFormat();
  const user = cardUser(viewData?.account, format);
  return (
    <div className="shell-foot" data-rail={rail ? 'true' : 'false'}>
      {validCredit(credit) ? <CreditRing rail={rail} credit={credit} /> : null}
      <div className="shell-user">
        <span className="shell-av" aria-hidden="true">
          {user.initials}
        </span>
        {rail ? (
          <span className="shell-vh">{user.name}</span>
        ) : (
          <span className="shell-ws-t">
            <b>{user.name}</b>
            <small>{user.role}</small>
          </span>
        )}
      </div>
      {viewData?.signOut ? <SignOutButton rail={rail} signOut={viewData.signOut} /> : null}
    </div>
  );
}

type SignOutPhase = 'idle' | 'pending' | 'failed';

/**
 * B1: sign-out button. No second request is sent while one is in flight.
 * If the request fails, the session stays open and a plain error text appears.
 * In compact mode there is no room for text, so the error appears as a short antd `message` toast (Ö-2).
 * In both modes the screen reader hears the text once, from the `alert` region next to the button.
 */
function SignOutButton({ rail, signOut }: { rail: boolean; signOut: () => Promise<void> }) {
  const [phase, setPhase] = useState<SignOutPhase>('idle');
  const busy = useRef(false);
  // Uses its own holder, so the toast appears even without the antd `App` wrapper.
  const [toast, toastHolder] = message.useMessage();

  const run = () => {
    if (busy.current) return;
    busy.current = true;
    setPhase('pending');
    signOut().then(
      () => {
        // On successful sign-out the browser leaves the page or the sign-in screen opens.
        busy.current = false;
      },
      () => {
        busy.current = false;
        setPhase('failed');
        if (rail) {
          // The toast is visual only. The announcement lives in the `alert` region, so the text is not read twice.
          // The icon is hidden too: the antd icon carries the English name "close-circle" (review 2, K-2).
          // The `anticon` class gives the icon antd's error colour and spacing.
          void toast.open({
            type: 'error',
            icon: (
              <span className="anticon" aria-hidden="true">
                <XCircle />
              </span>
            ),
            content: <span aria-hidden="true">{t.footer.signOutError}</span>,
          });
        }
      },
    );
  };

  return (
    <div className="shell-signout">
      {toastHolder}
      <Button
        type="text"
        block={!rail}
        icon={<SignOut aria-hidden="true" />}
        loading={phase === 'pending'}
        onClick={run}
        // Text colour comes from the footer card's surface.
        style={{ color: 'inherit', justifyContent: rail ? 'center' : 'flex-start' }}
        {...(rail ? { 'aria-label': t.footer.signOut } : {})}
      >
        {rail ? null : t.footer.signOut}
      </Button>
      <span className="shell-vh" role="status">
        {phase === 'pending' ? t.footer.signingOut : ''}
      </span>
      {phase === 'failed' ? (
        <p role="alert" className={rail ? 'shell-vh' : undefined} style={{ margin: 0 }}>
          {t.footer.signOutError}
        </p>
      ) : null}
    </div>
  );
}
