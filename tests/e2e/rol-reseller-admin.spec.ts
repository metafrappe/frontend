/**
 * "Reseller Admin" rolü: bayi yöneticisi (G-169, AJA-831). Test koddan önce yazıldı.
 * Bayi yöneticisi "Hesap", "Site ve plan" ve "Müşteriler" gruplarını görür.
 * Yeni müşteri isteği gönderir. Müşterinin iş verisini göremez.
 * Sunucu testi: `backend/.../access/tests/test_role_reseller_admin.py`.
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
  pagesClosed: [
    'Yönetim',
    'Yapay zekâ sağlayıcıları',
    'İzin talepleri',
    'Yapay zekâ işlemleri',
    'Genel ayarlar',
    'Marka',
    'İK ayarları',
  ],
  readOnly: [],
  buttons: [{ page: 'Müşteriler', shown: ['Yeni müşteri isteği'], hidden: [] }],
});
