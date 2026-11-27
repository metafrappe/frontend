/**
 * "Reseller Admin" role: reseller administrator (G-169, AJA-831). The test was written before the code.
 * The reseller administrator sees the account, site and plan, and customers menu groups.
 * They send new customer requests. They cannot see the customer's business data.
 * Server test: `backend/.../access/tests/test_role_reseller_admin.py`.
 */
import { describeRole } from '../setup/panel-rolleri';
import { test } from '../setup/playwright-fixtures';

test.describe.configure({ mode: 'parallel' });

describeRole({
  role: 'Reseller Admin',
  scenario: 'rol-reseller-admin',
  account: 'inceleme-bayi@example.test',
  menu: ['Hesap', 'Site ve plan', 'Müşteriler'],
  pagesOpen: ['Hesap', 'Site ve plan', 'Müşteriler'],
  pagesClosed: ['Yönetim', 'Yapay zekâ sağlayıcıları', 'İzin talepleri', 'Yapay zekâ işlemleri'],
  readOnly: [],
  buttons: [{ page: 'Müşteriler', shown: ['Yeni müşteri isteği'], hidden: [] }],
});
