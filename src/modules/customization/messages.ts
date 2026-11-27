/** "Özelleştirme" sayfasının ekran metinleri. Alan adlarını sunucunun tür tanımı verir. */
import { useModule } from '../context';

const en = {
  title: 'Customisation',
  intro: 'Add fields, rename or hide them, and arrange the side menu.',
  doctype: 'Document type',
  pickTitle: 'Choose a document type',
  chooseDoctype: 'Choose a document type to see its fields.',
  fields: 'Fields',
  noFields: 'This document type has no field you can change.',
  system: 'System field. This field cannot be changed.',
  hiddenTag: 'Hidden',
  addField: 'Add field',
  newField: 'New field',
  saveField: 'Add the field',
  fieldAdded: 'Field added.',
  rename: 'Rename',
  renameTitle: 'Rename the field',
  newName: 'New name',
  saveName: 'Save the name',
  renamed: 'The field name changed.',
  hide: 'Hide',
  show: 'Show',
  hiddenDone: 'Field hidden.',
  shownDone: 'Field is visible again.',
  closeForm: 'Close form',
  menu: 'Side menu',
  workspaces: 'Workspaces',
  noWorkspaces: 'There is no workspace in the menu.',
  edit: 'Edit',
  saveMenu: 'Save the menu',
  menuSaved: 'Menu saved.',
};

const tr: typeof en = {
  title: 'Özelleştirme',
  intro: 'Alan ekleyin, alanı yeniden adlandırın ya da gizleyin. Kenar menüsünü düzenleyin.',
  doctype: 'Belge türü',
  pickTitle: 'Belge türünü seçin',
  chooseDoctype: 'Alanları görmek için bir belge türü seçin.',
  fields: 'Alanlar',
  noFields: 'Bu belge türünde değiştirilebilir alan yok.',
  system: 'Sistem alanı. Bu alan değiştirilemez.',
  hiddenTag: 'Gizli',
  addField: 'Alan ekle',
  newField: 'Yeni alan',
  saveField: 'Alanı ekle',
  fieldAdded: 'Alan eklendi.',
  rename: 'Yeniden adlandır',
  renameTitle: 'Alanı yeniden adlandır',
  newName: 'Yeni ad',
  saveName: 'Adı kaydet',
  renamed: 'Alanın adı değişti.',
  hide: 'Gizle',
  show: 'Göster',
  hiddenDone: 'Alan gizlendi.',
  shownDone: 'Alan görünür oldu.',
  closeForm: 'Formu kapat',
  menu: 'Kenar menüsü',
  workspaces: 'Çalışma alanları',
  noWorkspaces: 'Menüde çalışma alanı yok.',
  edit: 'Düzenle',
  saveMenu: 'Menüyü kaydet',
  menuSaved: 'Menü kaydedildi.',
};

export const customizationMessages = { en, tr };
export type CustomizationCopy = typeof en;

export function useCustomizationCopy(): CustomizationCopy {
  return customizationMessages[useModule()?.locale ?? 'tr'];
}
