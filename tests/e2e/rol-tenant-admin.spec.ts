/**
 * "Tenant Admin" rolü: kiracı yöneticisi (G-62, AJA-831). Test koddan önce yazıldı.
 * Kiracı yöneticisi bugünkü panelin bütün gruplarını görür. "Müşteriler" grubunu görmez.
 * Sunucu testi: `backend/.../access/tests/test_role_tenant_admin.py`.
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
    'Genel ayarlar',
    'Marka',
    'İK ayarları',
  ],
  pagesOpen: [
    'Hesap',
    'Yönetim',
    'Yapay zekâ sağlayıcıları',
    'İzin talepleri',
    'Site ve plan',
    'Yapay zekâ işlemleri',
    'Genel ayarlar',
    'Marka',
    'İK ayarları',
  ],
  pagesClosed: ['Müşteriler'],
  readOnly: [],
  buttons: [
    { page: 'Yönetim', shown: ['Erişimi açıkla'], hidden: [] },
    { page: 'Site ve plan', shown: [], hidden: ['Yeni müşteri isteği'] },
  ],
});
