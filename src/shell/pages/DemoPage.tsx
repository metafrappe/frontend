import { Link } from 'react-router-dom';

import { PageHeader } from '../header/PageHeader';
import { t } from '../messages';
import { routes } from '../paths';

const noop = () => undefined;

/**
 * The shell's test page. Opens at `/_demo/shell` only in the e2e build.
 * Here the menu is rendered with sample groups. The page has a breadcrumb link and a text link.
 * Browser tests check focus, underline and touch area on these elements.
 */
export default function DemoPage() {
  return (
    <div className="shell-page">
      <PageHeader
        title={t.demo.title}
        crumbs={[{ label: t.pages.home, to: routes.home() }, { label: t.demo.title }]}
        view="report"
        onViewChange={noop}
        state={{ kind: 'normal', syncedAt: '10:42' }}
      />
      <div className="shell-body">
        <p className="shell-muted">{t.pages.sample}</p>
        <p>
          {t.demo.linkBefore} <Link to={routes.assistant()}>{t.demo.link}</Link> {t.demo.linkAfter}
        </p>
      </div>
    </div>
  );
}
