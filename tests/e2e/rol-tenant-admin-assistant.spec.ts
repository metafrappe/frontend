/**
 * "Tenant Admin Assistant" role: tenant administrator's assistant (G-168, AJA-831).
 * The test was written before the code.
 * The assistant sees the account, permission requests, site and plan, and AI operations menu groups.
 * In the administration group they see only the user list. The site and plan group is read-only.
 * Server test: `backend/.../access/tests/test_role_tenant_admin_assistant.py`.
 */
import { describeRole } from '../setup/panel-rolleri';
import { test } from '../setup/playwright-fixtures';

test.describe.configure({ mode: 'parallel' });

describeRole({
  role: 'Tenant Admin Assistant',
  scenario: 'rol-tenant-admin-assistant',
  account: 'inceleme-yonetici-yardimci@example.test',
  menu: ['Hesap', 'Yönetim', 'İzin talepleri', 'Site ve plan', 'Yapay zekâ işlemleri'],
  pagesOpen: ['Hesap', 'Yönetim', 'İzin talepleri', 'Site ve plan', 'Yapay zekâ işlemleri'],
  pagesClosed: ['Yapay zekâ sağlayıcıları', 'Müşteriler'],
  readOnly: ['Site ve plan'],
  buttons: [
    {
      page: 'Yönetim',
      shown: [],
      hidden: ['Erişimi açıkla', 'Yeni kullanıcı', 'Kullanıcıyı sil'],
    },
    {
      page: 'Site ve plan',
      shown: [],
      hidden: ['Planı değiştir', 'Siteyi sil', 'Siteyi devret', 'Yedekten geri yükle'],
    },
  ],
});
