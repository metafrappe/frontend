/**
 * "Tenant Admin" role: tenant administrator (G-62, AJA-831). The test was written before the code.
 * The tenant administrator sees all groups of the current panel. They do not see the customers group.
 * Server test: `backend/.../access/tests/test_role_tenant_admin.py`.
 */
import { describeRole } from '../setup/panel-rolleri';
import { test } from '../setup/playwright-fixtures';

test.describe.configure({ mode: 'parallel' });

describeRole({
  role: 'Tenant Admin',
  scenario: 'rol-tenant-admin',
  account: 'inceleme-yonetici@example.test',
  menu: [
    'Hesap',
    'Yönetim',
    'Yapay zekâ sağlayıcıları',
    'İzin talepleri',
    'Site ve plan',
    'Yapay zekâ işlemleri',
  ],
  pagesOpen: [
    'Hesap',
    'Yönetim',
    'Yapay zekâ sağlayıcıları',
    'İzin talepleri',
    'Site ve plan',
    'Yapay zekâ işlemleri',
  ],
  pagesClosed: ['Müşteriler'],
  readOnly: [],
  buttons: [
    { page: 'Yönetim', shown: ['Erişimi açıkla'], hidden: [] },
    { page: 'Site ve plan', shown: [], hidden: ['Yeni müşteri isteği'] },
  ],
});
