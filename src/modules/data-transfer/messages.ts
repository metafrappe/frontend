/**
 * "Veri aktarımı" sayfasının ekran metinleri (G-97 parça 3).
 * Kayıt türü ve alan adları bu dosyada değildir. Onları sunucu verir.
 */
import { useModule } from '../context';

const en = {
  title: 'Data transfer',
  intro: 'Import records from a file. Download a list as a file. Request a copy of your data.',
  importTitle: 'Import',
  importDoctype: 'Record type to import',
  exportDoctype: 'Record type to export',
  doctypePlaceholder: 'Choose a record type',
  noDoctypes: 'There is no record type you can use here.',
  template: 'Download template',
  templateNote: 'The template holds the fields you can fill in. Fill one record per row.',
  file: 'Import file',
  fileNote: 'Choose a CSV or Excel file.',
  upload: 'Upload file',
  uploading: 'Uploading',
  rowCount: (rows: number) => `The file has ${rows} rows.`,
  mapping: 'Column matching',
  mappingNote: 'Choose a field for each column. Columns set to "Do not import" are skipped.',
  columnField: (header: string) => `“${header}” column field`,
  skip: 'Do not import',
  start: 'Start import',
  starting: 'Starting',
  started: 'The import has started. The server works on it in order.',
  result: 'Show result',
  reading: 'Reading',
  statusPending: 'The import has not finished yet. Check again later.',
  statusSuccess: 'The import finished. Every row was saved.',
  statusPartial: 'The import partly finished. The failed rows are below.',
  statusError: 'The import failed. The failed rows are below.',
  statusTimedOut: 'The import took too long and stopped. The failed rows are below.',
  errorReport: 'Error report',
  failedRow: (rows: number[], message: string) =>
    `${rows.length > 0 ? `Row ${rows.join(', ')}` : 'Row unknown'}: ${message}`,
  noMessage: 'The server gave no reason.',
  exportTitle: 'Export',
  exportNote: 'The file only holds the fields you are allowed to read.',
  exportButton: 'Download CSV',
  exporting: 'Preparing',
  exported: (rows: number) => `${rows} records were downloaded.`,
  exportTruncated: (rows: number) =>
    `Only the first ${rows} records were downloaded. Narrow the list to get the rest.`,
  personalTitle: 'My personal data',
  personalNote:
    'You can ask for a copy of your personal data. This is your right under the KVKK law.',
  personalButton: 'Request my data',
  personalSending: 'Sending',
  personalDone: 'Your request was received. When the file is ready, a link comes to your email.',
};

const tr: typeof en = {
  title: 'Veri aktarımı',
  intro:
    'Dosyadan kayıt aktarın. Bir listeyi dosya olarak indirin. Verilerinizin kopyasını isteyin.',
  importTitle: 'İçe aktar',
  importDoctype: 'İçe aktarılacak kayıt türü',
  exportDoctype: 'Dışa aktarılacak kayıt türü',
  doctypePlaceholder: 'Kayıt türü seçin',
  noDoctypes: 'Burada kullanabileceğiniz kayıt türü yok.',
  template: 'Şablonu indir',
  templateNote: 'Şablonda doldurabileceğiniz alanlar var. Her satıra bir kayıt yazın.',
  file: 'Aktarım dosyası',
  fileNote: 'CSV ya da Excel dosyası seçin.',
  upload: 'Dosyayı yükle',
  uploading: 'Yükleniyor',
  rowCount: (rows: number) => `Dosyada ${rows} satır var.`,
  mapping: 'Sütun eşleme',
  mappingNote: 'Her sütun için bir alan seçin. “Aktarma” seçili sütunlar atlanır.',
  columnField: (header: string) => `“${header}” sütununun alanı`,
  skip: 'Aktarma',
  start: 'Aktarımı başlat',
  starting: 'Başlatılıyor',
  started: 'Aktarım başladı. Sunucu satırları sırayla işler.',
  result: 'Sonucu göster',
  reading: 'Okunuyor',
  statusPending: 'Aktarım henüz bitmedi. Biraz sonra yeniden bakın.',
  statusSuccess: 'Aktarım bitti. Bütün satırlar kaydedildi.',
  statusPartial: 'Aktarım kısmen bitti. Hatalı satırlar aşağıdadır.',
  statusError: 'Aktarım başarısız oldu. Hatalı satırlar aşağıdadır.',
  statusTimedOut: 'Aktarım çok uzun sürdü ve durdu. Hatalı satırlar aşağıdadır.',
  errorReport: 'Hata raporu',
  failedRow: (rows: number[], message: string) =>
    `${rows.length > 0 ? `Satır ${rows.join(', ')}` : 'Satır bilinmiyor'}: ${message}`,
  noMessage: 'Sunucu bir neden yazmadı.',
  exportTitle: 'Dışa aktar',
  exportNote: 'Dosyada yalnız okuma yetkiniz olan alanlar bulunur.',
  exportButton: 'CSV indir',
  exporting: 'Hazırlanıyor',
  exported: (rows: number) => `${rows} kayıt indirildi.`,
  exportTruncated: (rows: number) =>
    `Yalnız ilk ${rows} kayıt indirildi. Kalanlar için listeyi daraltın.`,
  personalTitle: 'Kişisel verilerim',
  personalNote:
    'Kişisel verilerinizin bir kopyasını isteyebilirsiniz. Bu, KVKK ile gelen hakkınızdır.',
  personalButton: 'Verilerimi iste',
  personalSending: 'Gönderiliyor',
  personalDone: 'Talebiniz alındı. Dosya hazır olunca e-posta adresinize bağlantı gelir.',
};

export const dataTransferMessages = { en, tr };
export type DataTransferCopy = typeof en;

export function useDataTransferCopy(): DataTransferCopy {
  return dataTransferMessages[useModule()?.locale ?? 'tr'];
}
