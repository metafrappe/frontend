import { Flex } from 'antd';
import type { ReactNode } from 'react';

export interface AuthLayoutProps {
  children: ReactNode;
  /** ID of the section heading. If given, the section is labelled by this heading. */
  labelledBy?: string;
}

/**
 * Shared layout for the sign-in, waiting and error screens. The outer element is the page's main region (`main`).
 * Built phone-first: there is side padding at 320 px wide.
 * On wide screens the content is centred in a narrow form column (`--form-max-width`).
 * All sizes come from the project's CSS variables (`src/design/css-variables.ts`).
 */
export function AuthLayout({ children, labelledBy }: AuthLayoutProps) {
  return (
    <Flex
      component="main"
      vertical
      gap="var(--space-md)"
      {...(labelledBy ? { 'aria-labelledby': labelledBy } : {})}
      style={{
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: 'var(--form-max-width)',
        marginInline: 'auto',
        paddingInline: 'var(--space-md)',
        paddingBlock: 'var(--space-xl)',
      }}
    >
      {children}
    </Flex>
  );
}
