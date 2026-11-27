/**
 * "Reseller Assistant" rolü: bayi yöneticisi yardımcısı (G-170, AJA-831).
 * Test koddan önce yazıldı.
 * Yardımcı "Hesap", "Müşteriler" ve "Site ve plan" gruplarını görür.
 * "Müşteriler" ve "Site ve plan" yalnız okunur.
 * Örnek: yardımcı "Müşteriler" sayfasını açar. Yeni müşteri düğmesini görmez.
 * Sunucu testi: `backend/.../access/tests/test_role_reseller_assistant.py`.
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
  pagesClosed: [
    'Özelleştirme',
    'Yönetim',
    'Yapay zekâ sağlayıcıları',
    'İzin talepleri',
    'Yapay zekâ işlemleri',
  ],
  readOnly: ['Site ve plan', 'Müşteriler'],
  buttons: [
    { page: 'Müşteriler', shown: [], hidden: ['Yeni müşteri isteği'] },
    { page: 'Site ve plan', shown: [], hidden: ['Planı değiştir'] },
  ],
});
