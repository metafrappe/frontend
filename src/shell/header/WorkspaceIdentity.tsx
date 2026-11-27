import { t } from '../messages';
import type { CommandMode } from '../sidebar/CommandBox';
import { workspaceText } from '../workspaceMessages';

interface WorkspaceIdentityProps {
  tenant?: string | undefined;
  environment: 'example' | 'live' | undefined;
  mode: CommandMode;
}

export function WorkspaceIdentity({ tenant, environment, mode }: WorkspaceIdentityProps) {
  return (
    <>
      <span className="shell-brand">
        <span className="shell-logo" aria-hidden="true" translate="no">
          A
        </span>
        <span>AtonotA</span>
      </span>
      <dl className="shell-identity-fields">
        <div>
          <dt>{workspaceText.tenant}</dt>
          <dd>{tenant || workspaceText.unknownTenant}</dd>
        </div>
        <div className="shell-environment" data-environment={environment ?? 'pending'}>
          <dt>{workspaceText.environment}</dt>
          <dd>{workspaceText[environment ?? 'pending']}</dd>
        </div>
        <div>
          <dt>{workspaceText.mode}</dt>
          <dd>{t.command.modes[mode]}</dd>
        </div>
      </dl>
    </>
  );
}
