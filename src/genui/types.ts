/**
 * GenUI blok sözleşmesi (U1).
 *
 * Asistan yanıtı `{ text, steps, ui[] }` biçimindedir. `ui` tipli blok dizisidir.
 * Sunucudan gelen veri güvenilmez sayılır. `schema.ts` her bloğu doğrular.
 */

export interface KpiItem {
  label: string;
  value: string;
  delta?: number;
  /** Değişim birimi. Örnek: "%" ya da "puan". */
  unit?: string;
  /** Düşüş iyi bir şeyse "down" olur. Örnek: iade oranı. */
  goodWhen?: 'up' | 'down';
}

export interface KpisBlock {
  type: 'kpis';
  items: KpiItem[];
}

export interface ChartBar {
  label: string;
  value: number;
}

export interface ChartBlock {
  type: 'chart';
  title: string;
  bars: ChartBar[];
}

export interface TableColumn {
  key: string;
  title: string;
  /**
   * `id`: kimlik ya da kısa değer. Satır sarılmaz, en küçük genişlik korunur.
   * `text`: açıklama. Kelimeler arasından sarılır. Varsayılan budur.
   */
  kind?: 'id' | 'text';
}

export type TableCell = string | number;

export interface TableBlock {
  type: 'table';
  title: string;
  rowKey: string;
  columns: TableColumn[];
  rows: Record<string, TableCell>[];
}

/** Yazma işleminde değişecek tek alan. Onay ekranı önce ve sonra değerini gösterir. */
export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

export interface ConfirmBlock {
  type: 'confirm';
  /**
   * İşlem kimliği. Sunucu onayı bu kimliğe bağlar.
   * Sözleşme: sunucu her yeni işlem için yeni bir kimlik üretir.
   * Aynı soru yeniden sorulsa da kimlik yenidir.
   * Onay tek kullanımlıktır. Aynı kimlik ikinci kez gönderilmez.
   */
  id: string;
  title: string;
  /** İşlemin özeti. Örnek: kime ne gideceği ve geri alınıp alınamayacağı. */
  summary: string;
  /** Değişecek alanlar. Boş olamaz. Kullanıcı değişikliği görmeden onay vermez. */
  changes: FieldChange[];
  /**
   * Old server label. Not shown: the card writes "Approve" in the UI language (AJA-1859).
   * The server's text may be in another language. The decision code stays `approved` either way.
   */
  confirmLabel?: string;
  /** Old server label. Not shown. */
  cancelLabel?: string;
  danger?: boolean;
  /**
   * Onayın son geçerlilik zamanı, ISO 8601. Örnek: `2026-11-24T12:00:00+03:00`.
   * Süre geçince blok "Süresi doldu" yazar ve onay düğmesi görünmez.
   */
  expiresAt?: string;
  /**
   * Risk düzeyi. Düzeyi sunucu atar, model değiştiremez.
   * Düzey gelmezse kart R1 gibi davranır.
   * - R1: tek "Onayla" düğmesi.
   * - R2: "Önizlemeyi okudum." kutusu işaretlenince düğme açılır.
   * - R3: kullanıcı `target.name` değerini elle yazınca düğme açılır.
   */
  risk?: ConfirmRisk;
  /** Hedef kayıt. `label` kartta görünür. R3 düzeyinde `name` elle yazılır. R3 için zorunludur. */
  target?: ConfirmTarget;
  /**
   * Sunucu geri alma önerisi ucunu bildirirse `true` olur.
   * Yalnız o zaman onaydan sonra "Geri almayı öner" düğmesi görünür.
   * Kartta hiçbir zaman "Geri al" düğmesi yoktur. Sunucuda geri alma yok.
   */
  undoProposal?: boolean;
}

/** Onay kartı yalnız yazan işlemde açılır. R0 okuma onay istemez. */
export type ConfirmRisk = Exclude<RiskLevel, 'R0'>;

export interface ConfirmTarget {
  label: string;
  name: string;
}

export interface FormOption {
  value: string;
  label: string;
}

export interface FormField {
  name: string;
  label: string;
  kind: 'text' | 'select' | 'checks';
  options?: FormOption[];
  value?: string | string[];
  required?: boolean;
}

export interface FormBlock {
  type: 'form';
  id: string;
  title: string;
  /**
   * Old server label. Not shown: the card writes its buttons in the UI language (AJA-1859).
   * Accepted so that old replies still render.
   */
  submitLabel?: string;
  /** Old server label. Not shown. */
  cancelLabel?: string;
  fields: FormField[];
}

export interface ChoicesBlock {
  type: 'choices';
  items: string[];
}

/*
 * Yapay zekâ yüzeyleri (AJA-1156). Model belgesi: "Onaylı bileşen listesi".
 * Dürüstlük kuralı: yüzeylerde güven yüzdesi ve modelin iç düşüncesi yoktur.
 * Şema bu yüzeylerde tanımsız alanı reddeder.
 */

/** Yardımcının kipi. Ekranda "Sor", "Ara", "Taslak hazırla" ya da "İşlem yap" yazar. */
export type AssistMode = 'ask' | 'search' | 'draft' | 'act';

/** Kapsam şeridi: işin hangi kiracıda, ortamda, kipte ve kapsamda yapıldığı. */
export interface ScopeBlock {
  type: 'scope';
  tenant: string;
  environment: string;
  mode: AssistMode;
  /** Örnek: "İnsan kaynakları, izin talepleri". */
  scope?: string;
}

/** Araç olayının durumu. Olay yalnız sunucudan gelince eklenir. */
export type ToolEventStatus = 'running' | 'done' | 'failed';

export interface ToolEvent {
  /** Olayın tekil kimliği. Liste sırası sunucunun gönderdiği sıradır. */
  id: string;
  /** Aracın adı. Örnek: `izin_talebi.oku`. */
  tool: string;
  summary: string;
  status: ToolEventStatus;
}

export interface EventsBlock {
  type: 'events';
  items: ToolEvent[];
}

/** Kaynak. Bağlantı yalnız `https://`, `http://` ya da `/` ile başlar. */
export interface SourceItem {
  title: string;
  url?: string;
}

/** Kaynak kartı. Liste boşsa kart "Kaynak yok." yazar. */
export interface SourceBlock {
  type: 'source';
  items: SourceItem[];
}

/** Risk düzeyini sunucu atar. Model düzeyi değiştiremez. */
export type RiskLevel = 'R0' | 'R1' | 'R2' | 'R3';

/** Değişiklik incelemesi. Salt okunurdur, onay düğmesi taşımaz. */
export interface ReviewBlock {
  type: 'review';
  /** Bir cümlelik özet. */
  summary: string;
  risk: RiskLevel;
  /** Hedef kayıt. */
  target: string;
  /** "Geri alınabilir mi?" sorusunun yanıtı. */
  reversible: string;
  changes: FieldChange[];
  /** Kaynaklar. Yoksa ekran "Kaynak yok." yazar. */
  sources?: SourceItem[];
}

export interface QueueItem {
  id: string;
  title: string;
  detail?: string;
  risk: RiskLevel;
}

/** Karar kuyruğu: kullanıcının kararını bekleyen işler. Salt okunurdur. */
export interface QueueBlock {
  type: 'queue';
  items: QueueItem[];
}

/** Sunucu işi bir kez yapar. Sonuç "başarılı", "başarısız" ya da "bilinmiyor" olur. */
export type ResultOutcome = 'succeeded' | 'failed' | 'unknown';

export interface ResultBlock {
  type: 'result';
  outcome: ResultOutcome;
  summary: string;
}

/** Doğrulanamayan blok. Kayıtlı türse JSON olarak gösterilir, değilse hiç çizilmez. */
export interface UnknownBlock {
  type: 'unknown';
  raw: unknown;
}

export type KnownBlock =
  | KpisBlock
  | ChartBlock
  | TableBlock
  | ConfirmBlock
  | FormBlock
  | ChoicesBlock
  | ScopeBlock
  | EventsBlock
  | SourceBlock
  | ReviewBlock
  | QueueBlock
  | ResultBlock;

export type GenUIBlock = KnownBlock | UnknownBlock;

export type BlockType = KnownBlock['type'];

export type FormValues = Record<string, string | string[]>;

/**
 * Eylemin sonucu.
 * - `accepted`: sohbet kararı aldı. Blok kilitlenir.
 * - `busy`: sohbet meşgul. Blok açık kalır, kullanıcı sonra yeniden dener.
 * - `used`: bu onay daha önce gönderildi. Blok kilitlenir, karar yeniden gitmez.
 */
export type GenUIActionResult = 'accepted' | 'busy' | 'used';

/** Eylemi alan işlev. */
export type GenUIActionHandler = (action: GenUIAction) => GenUIActionResult;

export type GenUIDecision = 'approved' | 'rejected';

/**
 * Sohbet geçmişinden çıkarılan kararlar. Anahtar blok kimliğidir.
 * Blok yeniden çizilince kararı buradan okur. Örnek: sohbet değişip geri gelince.
 */
export type GenUIDecisions = Readonly<Record<string, GenUIDecision>>;

/**
 * Bloktan çıkan kullanıcı eylemi.
 * Eylem yalnız kullanıcı bir düğmeye basınca oluşur (U4).
 * Sohbet bu eylemi yeni bir kullanıcı mesajına çevirir.
 */
export type GenUIAction =
  | { kind: 'ask'; text: string }
  | { kind: 'confirm'; blockId: string; decision: 'approved' | 'rejected'; title: string }
  | {
      kind: 'form';
      blockId: string;
      decision: 'approved' | 'rejected';
      title: string;
      values?: FormValues;
    };
