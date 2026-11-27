import { SignOut, XCircle } from '@phosphor-icons/react';
import { Button, message } from 'antd';
import { useRef, useState } from 'react';

import { useFormat, type Formatter } from '@/app/locale';

import { t } from '../messages';
import { sampleUser } from '../sampleData';
import type { ShellAccount, ShellCredit } from '../view-data';
import { useViewData } from '../view-data';

import { LanguageSelect } from './LanguageSelect';

interface SidebarFooterProps {
  rail: boolean;
  /** AI kredisi. Yoksa sayaç çizilmez. */
  credit?: ShellCredit | null;
}

/** Adın ilk iki sözcüğünün baş harfleri. Örnek: "Deneme Kullanıcı" -> "DK". Harf kullanıcının diliyle büyür. */
function initialsOf(name: string, format: Formatter): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, name.includes(' ') ? 2 : 1)
    .map((word) => format.upper(word.charAt(0)))
    .join('');
}

/** Oturumdaki kişi varsa onu, yoksa deneme sayfasının örnek kişisini gösterir. */
function cardUser(account: ShellAccount | undefined, format: Formatter) {
  if (!account) return sampleUser;
  const name = account.fullName?.trim() || account.user;
  // Ad varsa kimlik alt satırda görünür. Ad yoksa kimlik bir kez yazılır.
  return {
    name,
    role: name === account.user ? '' : account.user,
    initials: initialsOf(name, format),
  };
}

/** Kredi geçerli mi? Toplam sıfırdan büyük, kullanılan sıfır ya da daha büyük olmalı. */
function validCredit(credit: ShellCredit | null): credit is ShellCredit {
  return (
    credit !== null &&
    Number.isFinite(credit.used) &&
    Number.isFinite(credit.total) &&
    credit.total > 0 &&
    credit.used >= 0
  );
}

/** AI kredisi halkası. Sayılar sunucudan gelir. */
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
 * B1: AI kredisi ve kullanıcı. Sidebar'ın en koyu yüzeyidir.
 * Kredi verisi yoksa sayaç çizilmez. Uydurma sayı gösterilmez.
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
      {/* Dar şeritte listeye yer yoktur. Geniş kenar çubuğu ve telefon çekmecesi listeyi gösterir. */}
      {viewData?.saveLanguage && !rail ? <LanguageSelect save={viewData.saveLanguage} /> : null}
      {viewData?.signOut ? <SignOutButton rail={rail} signOut={viewData.signOut} /> : null}
    </div>
  );
}

type SignOutPhase = 'idle' | 'pending' | 'failed';

/**
 * B1: oturumu kapatma düğmesi. İstek sürerken ikinci istek gönderilmez.
 * İstek başarısız olursa oturum açık kalır ve yalın bir hata metni görünür.
 * Dar kipte metne yer yoktur. Hata o zaman antd `message` ile kısa bir uyarı olarak görünür (Ö-2).
 * Ekran okuyucu metni her iki kipte de düğmenin yanındaki `alert` alanından bir kez duyar.
 */
function SignOutButton({ rail, signOut }: { rail: boolean; signOut: () => Promise<void> }) {
  const [phase, setPhase] = useState<SignOutPhase>('idle');
  const busy = useRef(false);
  // Kendi tutucusuyla çalışır. Böylece antd `App` sarmalayıcısı olmadan da uyarı çıkar.
  const [toast, toastHolder] = message.useMessage();

  const run = () => {
    if (busy.current) return;
    busy.current = true;
    setPhase('pending');
    signOut().then(
      () => {
        // Başarılı çıkışta tarayıcı sayfadan ayrılır ya da giriş ekranı açılır.
        busy.current = false;
      },
      () => {
        busy.current = false;
        setPhase('failed');
        if (rail) {
          // Uyarı yalnız gözle görülür. Duyuru `alert` alanındadır. Metin iki kez okunmaz.
          // Simge de gizlidir. antd simgesi İngilizce "close-circle" adını taşır (inceleme 2, K-2).
          // `anticon` sınıfı antd'nin hata rengini ve aralığını simgeye verir.
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
        // Yazı rengi alt kartın yüzeyinden gelir.
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
