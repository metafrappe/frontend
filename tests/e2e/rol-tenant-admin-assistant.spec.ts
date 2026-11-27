/**
 * "Tenant Admin Assistant" rolü: kiracı yöneticisi yardımcısı (G-168, AJA-831).
 * Test koddan önce yazıldı.
 * Yardımcı "Hesap", "İzin talepleri", "Site ve plan" ve "Yapay zekâ işlemleri" gruplarını görür.
 * "Yönetim" grubunda yalnız kullanıcı listesini görür. "Site ve plan" yalnız okunur.
 * Sunucu testi: `backend/.../access/tests/test_role_tenant_admin_assistant.py`.
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
  pagesClosed: ['Özelleştirme', 'Yapay zekâ sağlayıcıları', 'Müşteriler'],
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
