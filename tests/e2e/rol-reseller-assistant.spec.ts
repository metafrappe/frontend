/**
 * "Reseller Assistant" role: reseller administrator's assistant (G-170, AJA-831).
 * The test was written before the code.
 * The assistant sees the account, customers, and site and plan menu groups.
 * The customers and site and plan groups are read-only.
 * Example: the assistant opens the customers page. They do not see the new customer button.
 * Server test: `backend/.../access/tests/test_role_reseller_assistant.py`.
 */
import { describeRole } from '../setup/panel-rolleri';
import { test } from '../setup/playwright-fixtures';

test.describe.configure({ mode: 'parallel' });

describeRole({
  role: 'Reseller Assistant',
  scenario: 'rol-reseller-assistant',
  account: 'inceleme-bayi-yardimci@example.test',
  menu: ['Hesap', 'Site ve plan', 'Müşteriler'],
  pagesOpen: ['Hesap', 'Site ve plan', 'Müşteriler'],
  pagesClosed: ['Yönetim', 'Yapay zekâ sağlayıcıları', 'İzin talepleri', 'Yapay zekâ işlemleri'],
  readOnly: ['Site ve plan', 'Müşteriler'],
  buttons: [
    { page: 'Müşteriler', shown: [], hidden: ['Yeni müşteri isteği'] },
    { page: 'Site ve plan', shown: [], hidden: ['Planı değiştir'] },
  ],
});
