import { ArrowClockwise } from '@phosphor-icons/react';
import { Button, Result } from 'antd';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

import { t } from '../messages';
import NotFoundPage from './NotFoundPage';
import { reloadPage } from './reloadPage';

/**
 * Route error screen.
 * On a 404 response "page not found" appears.
 * Other errors mean the page could not load. For example, the page file did not arrive.
 * In that case the "Yeniden dene" (try again) button reloads the page.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <div className="shell-page">
      <Result
        status="warning"
        title={<h1 className="shell-h1">{t.pages.loadError}</h1>}
        subTitle={t.pages.loadErrorText}
        extra={
          <Button type="primary" icon={<ArrowClockwise aria-hidden="true" />} onClick={reloadPage}>
            {t.header.state.retry}
          </Button>
        }
      />
    </div>
  );
}
