import { Bubble, XProvider } from '@ant-design/x';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// The @ant-design/x import must load under a clean `npm ci` + Node 24 (antd/es/version directory).
describe('Ant Design X yüklemesi', () => {
  it('XProvider ve Bubble jsdom altında çizilir', () => {
    render(
      <XProvider>
        <Bubble content="Merhaba" />
      </XProvider>,
    );
    expect(screen.getByText('Merhaba')).toBeInTheDocument();
  });
});
