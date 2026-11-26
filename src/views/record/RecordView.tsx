import './RecordView.css';

import {
  CaretDown,
  CaretRight,
  CheckCircle,
  FloppyDisk,
  WarningCircle,
} from '@phosphor-icons/react';
import { Button, ConfigProvider, Tabs } from 'antd';
import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { HelpDoctype, HelpMarker } from '@/shell/help';

import { RecordApiError } from './adapter';
import { CatalogField } from './catalog';
import { CATALOG_VERSION } from './catalogRegistry';
import { buildFormLayout, isLayoutBreakFieldType, type LayoutSection } from './layout';
import { formatRecordMessage } from './messages';
import { applyNewRecordContext, formatLeaveBalance, prefillSourceNote } from './prefill';
import { RecordErrorBoundary } from './RecordErrorBoundary';
import { RecordNavigator } from './RecordNavigator';
import { RecordLinkProvider, type RecordLinkRenderer } from './recordLink';
import {
  EmptyRecordState,
  ErrorRecordState,
  LoadingRecordState,
  UnauthorizedRecordState,
} from './RecordStates';
import { SchemaValidationError, validateRecordAgainstMeta } from './schema';
import {
  buildRecordAntdTheme,
  buildRecordCssVariables,
  RECORD_PHONE_MAX_WIDTH_PX,
  type RecordThemeMode,
} from './tokens';
import type {
  DocField,
  DocTypeMeta,
  RecordAssistRequest,
  RecordConflictInfo,
  RecordDataAdapter,
  RecordDocument,
  RecordLocale,
  PrefillSource,
  RecordScreenState,
  SiteFormatting,
} from './types';
import { computeDirtyFields, validateRecordDraft } from './validation';

/**
 * Measures container width against central `RECORD_PHONE_MAX_WIDTH_PX` token (Review 3 Minor 9).
 * Falls back to `window.innerWidth` in non-layout environments such as jsdom (`width === 0`).
 */
function useIsPhoneContainer(containerRef: RefObject<HTMLDivElement | null>): boolean {
  const [isPhone, setIsPhone] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.innerWidth <= RECORD_PHONE_MAX_WIDTH_PX;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleWindowResize = () => {
      const containerWidth = containerRef.current?.getBoundingClientRect().width ?? 0;
      const effectiveWidth = containerWidth > 0 ? containerWidth : window.innerWidth;
      setIsPhone(effectiveWidth <= RECORD_PHONE_MAX_WIDTH_PX);
    };

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        const observedWidth = entry ? entry.contentRect.width : 0;
        const effectiveWidth = observedWidth > 0 ? observedWidth : window.innerWidth;
        setIsPhone(effectiveWidth <= RECORD_PHONE_MAX_WIDTH_PX);
      });
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', handleWindowResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [containerRef]);

  return isPhone;
}

/**
 * Tracks keyboard focus modality at the document capture level so Tab entering from outside
 * `.rv-root` activates focus indicators on the very first focused control (Review 3 Minor 10).
 * Also respects `document.documentElement.dataset.focusMode` when managed by `foundation`.
 */
function useKeyboardFocusModality(): boolean {
  const [isKeyboard, setIsKeyboard] = useState<boolean>(() => {
    if (typeof document === 'undefined') {
      return false;
    }
    return document.documentElement.dataset['focusMode'] === 'keyboard';
  });

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        setIsKeyboard(true);
      }
    };
    const onPointerDown = () => {
      setIsKeyboard(false);
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('touchstart', onPointerDown, true);

    let attrObserver: MutationObserver | undefined;
    if (typeof MutationObserver !== 'undefined') {
      attrObserver = new MutationObserver(() => {
        const mode = document.documentElement.dataset['focusMode'];
        if (mode === 'keyboard') {
          setIsKeyboard(true);
        } else if (mode === 'pointer') {
          setIsKeyboard(false);
        }
      });
      attrObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-focus-mode'],
      });
    }

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('touchstart', onPointerDown, true);
      attrObserver?.disconnect();
    };
  }, []);

  return isKeyboard;
}

function buildInitialNewRecord(meta: DocTypeMeta): RecordDocument {
  const initial: RecordDocument = { name: '' };
  for (const field of meta.schema.fields) {
    if (isLayoutBreakFieldType(field.fieldtype)) {
      continue;
    }
    if (field.default !== undefined && field.default !== null) {
      initial[field.fieldname] = field.default;
    } else if (field.fieldtype === 'Table' || field.fieldtype === 'Table MultiSelect') {
      initial[field.fieldname] = [];
    } else if (field.fieldtype === 'Check') {
      initial[field.fieldname] = 0;
    }
  }
  return initial;
}

/** Kayıt formunun yardım kaydındaki bileşen kimliği (G-138 `component_id`). */
export const RECORD_FORM_HELP_ID = 'record-form';

export interface RecordNavigatorConfig {
  currentIndex: number;
  totalCount: number;
  onNavigate?: ((nextIndex: number) => void) | undefined;
}

export interface RecordViewProps {
  doctype: string;
  title?: string | undefined;
  saveActionLabel?: string | undefined;
  name?: string | undefined;
  createMode?: boolean | undefined;
  /**
   * Kayıt verisinin kaynağı. Uygulama girişi oturumun ortak API istemcisiyle kurar
   * (`createFrappeRecordAdapter({ api })`). Varsayılan bağdaştırıcı yoktur (SZ-5).
   */
  adapter: RecordDataAdapter;
  locale?: RecordLocale | undefined;
  themeMode?: RecordThemeMode | undefined;
  formatting?: SiteFormatting | undefined;
  breadcrumbs?: readonly string[] | undefined;
  navigator?: RecordNavigatorConfig | undefined;
  onSaved?: ((record: RecordDocument) => void) | undefined;
  onCreateNew?: (() => void) | undefined;
  onSignIn?: (() => void) | undefined;
  /**
   * Salt okunur bağlantı alanındaki hedef kayda bağlantı çizer. Uygulama yönlendiricinin
   * bağlantısını verir. Verilmezse hedef kaydın adı düz metin olarak görünür.
   */
  renderRecordLink?: RecordLinkRenderer | undefined;
  /**
   * Uzun metin alanındaki "Yardımcıyla yaz" düğmesinin olayı. Uygulama yardımcı paneli açar.
   * Form alanı değiştirmez. Verilmezse düğme görünmez.
   */
  onAssistField?: ((request: RecordAssistRequest) => void) | undefined;
}

function RecordSectionCard(props: {
  section: LayoutSection;
  collapsed: boolean;
  onToggleCollapse: () => void;
  effectiveDoc: Readonly<Record<string, unknown>>;
  baseRecord: Readonly<Record<string, unknown>>;
  prefillSources: Readonly<Record<string, PrefillSource>> | undefined;
  draftEdits: Readonly<Record<string, unknown>>;
  doctype: string;
  meta: DocTypeMeta;
  adapter: RecordDataAdapter;
  locale: RecordLocale;
  formatting?: SiteFormatting | undefined;
  isExistingRecord: boolean;
  isRecordReadOnly: boolean;
  dirtySet: ReadonlySet<string>;
  fieldErrors: Readonly<Record<string, string>>;
  isSaving: boolean;
  onFieldChange: (fieldname: string, nextValue: unknown) => void;
  onFieldAction: (field: DocField) => void;
  onAssistField?: ((request: RecordAssistRequest) => void) | undefined;
}) {
  const {
    section,
    collapsed,
    onToggleCollapse,
    effectiveDoc,
    baseRecord,
    prefillSources,
    draftEdits,
    doctype,
    meta,
    adapter,
    locale,
    formatting,
    isExistingRecord,
    isRecordReadOnly,
    dirtySet,
    fieldErrors,
    isSaving,
    onFieldChange,
    onFieldAction,
    onAssistField,
  } = props;

  const headingId = useId();
  const sectionLabel = section.label?.trim();
  const gridStyle = {
    '--rv-section-cols': String(section.effectiveColumnCount),
  } as CSSProperties;

  return (
    <section className="rv-section-card" aria-labelledby={sectionLabel ? headingId : undefined}>
      {sectionLabel ? (
        <div className="rv-section-header">
          <h2 id={headingId} className="rv-section-title">
            {sectionLabel}
          </h2>
          {section.collapsible ? (
            <Button
              size="small"
              type="text"
              icon={collapsed ? <CaretRight weight="regular" /> : <CaretDown weight="regular" />}
              aria-expanded={!collapsed}
              aria-label={formatRecordMessage(locale, 'sectionCollapseToggle', {
                label: sectionLabel,
              })}
              onClick={onToggleCollapse}
            />
          ) : null}
        </div>
      ) : null}

      {section.description && !collapsed ? (
        <p className="rv-section-description">{section.description}</p>
      ) : null}

      {!collapsed ? (
        <div className="rv-section-grid" style={gridStyle}>
          {section.columns.map((col) => (
            <div key={col.key} className="rv-column">
              {col.label ? <h3 className="rv-column-title">{col.label}</h3> : null}
              {col.fields.map((field) => (
                <CatalogField
                  key={field.fieldname}
                  field={field}
                  value={effectiveDoc[field.fieldname]}
                  readOnlyDisplayValue={
                    !isExistingRecord &&
                    doctype === 'Leave Application' &&
                    field.fieldname === 'leave_balance'
                      ? formatLeaveBalance(effectiveDoc[field.fieldname], locale)
                      : undefined
                  }
                  doc={effectiveDoc}
                  doctype={doctype}
                  meta={meta}
                  adapter={adapter}
                  locale={locale}
                  formatting={formatting}
                  catalogVersion={meta.catalog_version}
                  isExistingRecord={isExistingRecord}
                  baseValue={baseRecord[field.fieldname]}
                  parentReadOnly={isRecordReadOnly}
                  isDirty={dirtySet.has(field.fieldname)}
                  isSubmitting={isSaving}
                  error={fieldErrors[field.fieldname]}
                  sourceNote={
                    field.fieldname in draftEdits
                      ? undefined
                      : prefillSourceNote(prefillSources?.[field.fieldname], locale)
                  }
                  onChange={onFieldChange}
                  onFieldAction={onFieldAction}
                  onAssistField={onAssistField}
                />
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

interface RecordViewBodyProps extends RecordViewProps {
  isPhoneViewport: boolean;
}

function RecordViewBody(props: RecordViewBodyProps) {
  const {
    doctype,
    title,
    saveActionLabel,
    name,
    createMode = false,
    adapter,
    locale = 'tr',
    formatting,
    breadcrumbs,
    navigator: navigatorCfg,
    onSaved,
    onCreateNew,
    onSignIn,
    onAssistField,
    isPhoneViewport,
  } = props;

  const [screenState, setScreenState] = useState<RecordScreenState>(() =>
    !name && !createMode ? { status: 'empty', reason: 'no_record' } : { status: 'loading' },
  );
  const [reloadNonce, setReloadNonce] = useState(0);

  // RE-5: Server record stays in screenState; only user draft overrides live in draftEdits.
  // Review 3 Blocker 1: Keying RecordViewBody by record identity resets local state on navigation
  // without calling setState synchronously inside useEffect.
  const [draftEdits, setDraftEdits] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validationAttempt, setValidationAttempt] = useState({ fieldname: '', sequence: 0 });
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = formRef.current;
    if (!form || !validationAttempt.fieldname) return;
    // Ant Design mounts and reveals tab panels after the parent's commit. Wait for that
    // DOM change, then disconnect. No timer or animation duration controls focus.
    const focusInvalidField = () => {
      const field = Array.from(
        form.querySelectorAll<HTMLElement>('.rv-field[data-fieldname]'),
      ).find((element) => element.dataset['fieldname'] === validationAttempt.fieldname);
      const control = field?.querySelector<HTMLElement>(
        'input[aria-invalid="true"], textarea[aria-invalid="true"], button[aria-invalid="true"], [aria-invalid="true"][tabindex]:not([tabindex="-1"])',
      );
      if (!control || control.closest('[hidden], [aria-hidden="true"], .ant-tabs-tabpane-hidden'))
        return false;
      control.focus();
      if (document.activeElement !== control) return false;
      field?.scrollIntoView?.({ block: 'center', behavior: 'instant' });
      return true;
    };
    if (focusInvalidField()) return;
    const observer = new MutationObserver(() => {
      if (focusInvalidField()) observer.disconnect();
    });
    observer.observe(form, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'aria-invalid'],
    });
    return () => observer.disconnect();
  }, [validationAttempt]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<RecordConflictInfo | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [activeTabKey, setActiveTabKey] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  const requestSeqRef = useRef(0);
  const savingLockRef = useRef(false);

  useEffect(() => {
    if (!name && !createMode) {
      return undefined;
    }

    const controller = new AbortController();
    requestSeqRef.current += 1;
    const currentSeq = requestSeqRef.current;

    const load = async () => {
      try {
        const metaPromise = adapter.getDocTypeMeta({
          doctype,
          language: locale,
          signal: controller.signal,
        });

        if (createMode || !name) {
          const loadContext = async () => {
            try {
              return await adapter.getNewRecordContext?.({ doctype, signal: controller.signal });
            } catch (err) {
              // Context is optional. Invalid responses and expired sessions keep their error flow.
              if (
                err instanceof RecordApiError &&
                err.code !== 'invalid_response' &&
                err.code !== 'session_expired'
              ) {
                return undefined;
              }
              throw err;
            }
          };
          const [meta, context] = await Promise.all([metaPromise, loadContext()]);
          if (controller.signal.aborted || currentSeq !== requestSeqRef.current) {
            return;
          }
          if (meta.truncated) {
            setScreenState({
              status: 'error',
              code: 'truncated_meta',
              message: formatRecordMessage(locale, 'errorTruncatedMeta'),
            });
            return;
          }
          setScreenState({
            status: 'ready',
            ...applyNewRecordContext(meta, buildInitialNewRecord(meta), context),
          });
          return;
        }

        const [meta, record] = await Promise.all([
          metaPromise,
          adapter.getRecord({ doctype, name, signal: controller.signal }),
        ]);

        if (controller.signal.aborted || currentSeq !== requestSeqRef.current) {
          return;
        }

        if (meta.truncated) {
          setScreenState({
            status: 'error',
            code: 'truncated_meta',
            message: formatRecordMessage(locale, 'errorTruncatedMeta'),
          });
          return;
        }

        let validatedRecord: RecordDocument;
        try {
          validatedRecord = validateRecordAgainstMeta(record, meta);
        } catch (err) {
          if (err instanceof SchemaValidationError) {
            setScreenState({
              status: 'error',
              code: 'invalid_response',
              message: formatRecordMessage(locale, 'invalidServerResponse'),
            });
            return;
          }
          throw err;
        }

        setScreenState({
          status: 'ready',
          meta,
          record: validatedRecord,
        });
      } catch (err) {
        if (controller.signal.aborted || currentSeq !== requestSeqRef.current) {
          return;
        }
        if (err instanceof RecordApiError) {
          if (err.code === 'unauthorized') {
            setScreenState({ status: 'unauthorized', reason: 'permission_denied' });
            return;
          }
          if (err.code === 'session_expired') {
            setScreenState({ status: 'unauthorized', reason: 'session_expired' });
            return;
          }
          if (err.code === 'not_found') {
            setScreenState({ status: 'empty', reason: 'not_found' });
            return;
          }
          setScreenState({
            status: 'error',
            code: err.code,
            message: err.message,
          });
          return;
        }
        setScreenState({
          status: 'error',
          code: 'server_error',
          message: formatRecordMessage(locale, 'errorDefaultDescription'),
        });
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, [adapter, createMode, doctype, locale, name, reloadNonce]);

  const handleRetry = useCallback(() => {
    setDraftEdits({});
    setFieldErrors({});
    setActionError(null);
    setConflict(null);
    setScreenState(
      !name && !createMode ? { status: 'empty', reason: 'no_record' } : { status: 'loading' },
    );
    setReloadNonce((n) => n + 1);
  }, [createMode, name]);

  const handleFieldChange = useCallback((fieldname: string, nextValue: unknown) => {
    setDraftEdits((prev) => ({
      ...prev,
      [fieldname]: nextValue,
    }));
    setFieldErrors((prev) => {
      if (!(fieldname in prev)) {
        return prev;
      }
      const { [fieldname]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleDiscard = useCallback(() => {
    setDraftEdits({});
    setFieldErrors({});
    setActionError(null);
    setConflict(null);
  }, []);

  const readyMeta = screenState.status === 'ready' ? screenState.meta : undefined;
  const baseRecord = screenState.status === 'ready' ? screenState.record : undefined;

  const effectiveDoc = useMemo<Readonly<Record<string, unknown>>>(() => {
    if (!baseRecord) {
      return draftEdits;
    }
    return {
      ...baseRecord,
      ...draftEdits,
    };
  }, [baseRecord, draftEdits]);

  const dirtyFields = useMemo(() => {
    if (!readyMeta || !baseRecord) {
      return [];
    }
    return computeDirtyFields(readyMeta.schema.fields, baseRecord, effectiveDoc);
  }, [baseRecord, effectiveDoc, readyMeta]);

  const dirtySet = useMemo(() => new Set(dirtyFields), [dirtyFields]);
  const dirtyCount = dirtyFields.length;

  const layout = useMemo(() => {
    if (!readyMeta) {
      return { hasExplicitTabs: false, tabs: [] };
    }
    return buildFormLayout(readyMeta.schema.fields, {
      doc: effectiveDoc,
      isPhoneViewport,
      defaultTabLabel: formatRecordMessage(locale, 'defaultTabLabel'),
    });
  }, [effectiveDoc, isPhoneViewport, locale, readyMeta]);

  const showValidationErrors = useCallback(
    (errors: Record<string, string>) => {
      setFieldErrors(errors);
      for (const tab of layout.tabs) {
        for (const section of tab.sections) {
          const firstInvalid = section.columns
            .flatMap((column) => column.fields)
            .find((field) => errors[field.fieldname]);
          if (!firstInvalid) continue;
          setActiveTabKey(tab.key);
          setCollapsedSections((previous) => ({ ...previous, [section.key]: false }));
          setValidationAttempt((previous) => ({
            fieldname: firstInvalid.fieldname,
            sequence: previous.sequence + 1,
          }));
          return;
        }
      }
      setValidationAttempt((previous) => ({ fieldname: '', sequence: previous.sequence + 1 }));
    },
    [layout],
  );
  const handleSave = useCallback(async () => {
    if (screenState.status !== 'ready' || savingLockRef.current) {
      return;
    }
    const { meta, record } = screenState;
    // Review 3 Finding 2: Once saved, record.name is populated so the view exits new-record mode.
    if (
      record.docstatus === 1 ||
      record.docstatus === 2 ||
      !meta.schema.fields.some(
        (field) => !isLayoutBreakFieldType(field.fieldtype) && !field.read_only,
      )
    ) {
      return;
    }
    const isNewRecord = record.name.length === 0;
    if (!isNewRecord && dirtyFields.length === 0) {
      return;
    }

    const validationErrors = validateRecordDraft(meta, effectiveDoc, locale, {
      isExistingRecord: !isNewRecord,
      baseRecord: record,
    });

    if (Object.keys(validationErrors).length > 0) {
      showValidationErrors(validationErrors);
      return;
    }

    savingLockRef.current = true;
    setIsSaving(true);
    setActionError(null);

    const payload: Record<string, unknown> = {};
    if (isNewRecord) {
      for (const field of meta.schema.fields) {
        if (!isLayoutBreakFieldType(field.fieldtype) && !field.read_only) {
          if (field.fieldname in effectiveDoc) {
            payload[field.fieldname] = effectiveDoc[field.fieldname];
          }
        }
      }
    } else {
      for (const fname of dirtyFields) {
        payload[fname] = effectiveDoc[fname];
      }
    }

    try {
      const rawSaved = await adapter.saveRecord({
        doctype,
        name: isNewRecord ? undefined : record.name,
        modified: record.modified,
        data: payload,
      });

      // Review 3 Finding 4: Validate saveRecord response against DocTypeMeta before applying (SZ-4).
      let saved: RecordDocument;
      try {
        saved = validateRecordAgainstMeta(rawSaved, meta);
      } catch (validationErr) {
        if (validationErr instanceof SchemaValidationError) {
          setScreenState({
            status: 'error',
            code: 'invalid_response',
            message: formatRecordMessage(locale, 'invalidServerResponse'),
          });
          return;
        }
        throw validationErr;
      }

      setScreenState({
        status: 'ready',
        meta,
        record: saved,
      });
      setDraftEdits({});
      setFieldErrors({});
      setConflict(null);
      onSaved?.(saved);
    } catch (err) {
      if (err instanceof RecordApiError) {
        if (err.code === 'conflict') {
          let latestServerRecord: RecordDocument | undefined;
          if (record.name.length > 0) {
            try {
              const rawLatest = await adapter.getRecord({ doctype, name: record.name });
              // Review 3 Finding 4: Validate conflict latestRecord against DocTypeMeta (SZ-4).
              latestServerRecord = validateRecordAgainstMeta(rawLatest, meta);
            } catch (conflictFetchErr) {
              if (
                conflictFetchErr instanceof SchemaValidationError ||
                (conflictFetchErr instanceof RecordApiError &&
                  conflictFetchErr.code === 'invalid_response')
              ) {
                setScreenState({
                  status: 'error',
                  code: 'invalid_response',
                  message: formatRecordMessage(locale, 'invalidServerResponse'),
                });
                return;
              }
              latestServerRecord = undefined;
            }
          }
          // SZ-11: Preserve user draft values completely on conflict!
          setConflict({
            message: err.message,
            attemptedModified: record.modified ?? '',
            latestRecord: latestServerRecord,
          });
        } else if (err.code === 'validation') {
          if (err.fieldErrors) {
            showValidationErrors({ ...err.fieldErrors });
          }
          setActionError(err.message);
        } else if (err.code === 'invalid_response') {
          setScreenState({
            status: 'error',
            code: 'invalid_response',
            message: err.message,
          });
        } else if (err.code === 'session_expired') {
          setScreenState({ status: 'unauthorized', reason: 'session_expired' });
        } else if (err.code === 'unauthorized') {
          setScreenState({ status: 'unauthorized', reason: 'permission_denied' });
        } else {
          setActionError(err.message);
        }
      } else {
        setActionError(formatRecordMessage(locale, 'errorDefaultDescription'));
      }
    } finally {
      savingLockRef.current = false;
      setIsSaving(false);
    }
  }, [
    adapter,
    dirtyFields,
    doctype,
    effectiveDoc,
    locale,
    onSaved,
    screenState,
    showValidationErrors,
  ]);

  const handleFieldAction = useCallback(
    async (field: DocField) => {
      if (
        screenState.status !== 'ready' ||
        savingLockRef.current ||
        !adapter.runDocAction ||
        !screenState.record.name ||
        !screenState.record.modified
      ) {
        return;
      }
      savingLockRef.current = true;
      setIsSaving(true);
      setActionError(null);
      try {
        const actionName =
          field.options && field.options.trim().length > 0 ? field.options.trim() : field.fieldname;
        const updated = await adapter.runDocAction({
          doctype,
          name: screenState.record.name,
          action: actionName,
          modified: screenState.record.modified,
        });
        if (updated) {
          const validatedUpdated = validateRecordAgainstMeta(updated, screenState.meta);
          setScreenState({
            status: 'ready',
            meta: screenState.meta,
            record: validatedUpdated,
          });
        }
      } catch (err) {
        if (err instanceof SchemaValidationError) {
          setScreenState({
            status: 'error',
            code: 'invalid_response',
            message: formatRecordMessage(locale, 'invalidServerResponse'),
          });
          return;
        }
        setActionError(
          err instanceof RecordApiError
            ? err.message
            : formatRecordMessage(locale, 'errorDefaultDescription'),
        );
      } finally {
        savingLockRef.current = false;
        setIsSaving(false);
      }
    },
    [adapter, doctype, locale, screenState],
  );

  if (screenState.status === 'loading') {
    return <LoadingRecordState locale={locale} />;
  }

  if (screenState.status === 'empty') {
    return (
      <EmptyRecordState locale={locale} reason={screenState.reason} onCreateNew={onCreateNew} />
    );
  }

  if (screenState.status === 'unauthorized') {
    return (
      <UnauthorizedRecordState locale={locale} reason={screenState.reason} onSignIn={onSignIn} />
    );
  }

  if (screenState.status === 'error') {
    return <ErrorRecordState locale={locale} message={screenState.message} onRetry={handleRetry} />;
  }

  const { meta, record } = screenState;
  const isNewRecord = record.name.length === 0;
  const titleField = meta.schema.title_field;
  const rawTitle = titleField ? effectiveDoc[titleField] : undefined;
  const displayTitle =
    title ??
    (typeof rawTitle === 'string' && rawTitle.trim().length > 0
      ? rawTitle.trim()
      : !isNewRecord
        ? record.name
        : meta.schema.name);

  const isRecordReadOnly = record.docstatus === 1 || record.docstatus === 2;
  const hasWritableFields = meta.schema.fields.some(
    (f) => !isLayoutBreakFieldType(f.fieldtype) && !f.read_only,
  );
  const canEdit = !isRecordReadOnly && hasWritableFields;
  const isDirty = dirtyCount > 0;

  const crumbItems =
    breadcrumbs ??
    [meta.schema.module, meta.schema.name, record.name].filter(
      (item): item is string => typeof item === 'string' && item.length > 0,
    );

  const docstatusBadge =
    record.docstatus === 1
      ? {
          className: 'rv-pill rv-pill--success',
          text: formatRecordMessage(locale, 'statusSubmitted'),
        }
      : record.docstatus === 2
        ? {
            className: 'rv-pill rv-pill--danger',
            text: formatRecordMessage(locale, 'statusCancelled'),
          }
        : {
            className: 'rv-pill rv-pill--primary',
            text: formatRecordMessage(locale, 'statusDraft'),
          };

  const renderSections = (sections: readonly LayoutSection[]) =>
    sections.map((sec) => (
      <RecordSectionCard
        key={sec.key}
        section={sec}
        collapsed={collapsedSections[sec.key] === true}
        onToggleCollapse={() =>
          setCollapsedSections((prev) => ({
            ...prev,
            [sec.key]: prev[sec.key] !== true,
          }))
        }
        effectiveDoc={effectiveDoc}
        baseRecord={record}
        prefillSources={screenState.prefillSources}
        draftEdits={draftEdits}
        doctype={doctype}
        meta={meta}
        adapter={adapter}
        locale={locale}
        formatting={formatting}
        isExistingRecord={!isNewRecord}
        isRecordReadOnly={isRecordReadOnly}
        dirtySet={dirtySet}
        fieldErrors={fieldErrors}
        isSaving={isSaving}
        onFieldChange={handleFieldChange}
        onFieldAction={(f) => {
          void handleFieldAction(f);
        }}
        onAssistField={onAssistField}
      />
    ));

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
    >
      <header className="rv-header">
        {crumbItems.length > 0 ? (
          <nav
            className="rv-header-breadcrumbs"
            aria-label={formatRecordMessage(locale, 'breadcrumbLabel')}
          >
            {crumbItems.map((crumb, idx) => (
              <span key={`${crumb}-${idx}`}>
                {idx > 0 ? ' / ' : ''}
                {crumb}
              </span>
            ))}
          </nav>
        ) : null}

        <div className="rv-header-top">
          <div className="rv-header-title-group">
            <h1 className="rv-header-title">{displayTitle}</h1>
            <HelpMarker
              target={{
                kind: 'component',
                componentId: RECORD_FORM_HELP_ID,
                label: formatRecordMessage(locale, 'helpComponentLabel'),
              }}
            />
            <span className={docstatusBadge.className}>{docstatusBadge.text}</span>
            {isDirty ? (
              <span className="rv-sync-badge rv-sync-badge--dirty" role="status">
                <i className="rv-dirty-dot" aria-hidden="true" />
                {formatRecordMessage(locale, 'unsavedChangesCount', { count: dirtyCount })}
              </span>
            ) : (
              <span className="rv-sync-badge">
                <CheckCircle weight="regular" />
                {formatRecordMessage(locale, 'upToDateStatus')}
              </span>
            )}
          </div>

          <div className="rv-header-actions">
            {isDirty ? (
              <Button size="middle" disabled={isSaving} onClick={handleDiscard}>
                {formatRecordMessage(locale, 'discardAction')}
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                size="middle"
                type="primary"
                htmlType="submit"
                icon={<FloppyDisk weight="regular" />}
                loading={isSaving}
                disabled={isSaving || (!isDirty && !isNewRecord)}
              >
                {isSaving
                  ? formatRecordMessage(locale, 'savingAction')
                  : (saveActionLabel ?? formatRecordMessage(locale, 'saveAction'))}
              </Button>
            ) : null}
          </div>
        </div>

        {navigatorCfg ? (
          <div className="rv-header-toolbar">
            <RecordNavigator
              currentIndex={navigatorCfg.currentIndex}
              totalCount={navigatorCfg.totalCount}
              locale={locale}
              disabled={isSaving}
              hasUnsavedChanges={isDirty}
              onDiscardBeforeNavigate={handleDiscard}
              onNavigate={navigatorCfg.onNavigate}
            />
          </div>
        ) : null}
      </header>

      {/* Alan yardım işaretleri sunucudan bu belge türüyle yardım ister (G-138). */}
      <HelpDoctype.Provider value={doctype}>
        <div className="rv-body">
          {meta.catalog_version > CATALOG_VERSION ? (
            <div className="rv-banner rv-banner--warning" role="status">
              <span>
                {formatRecordMessage(locale, 'catalogVersionWarning', {
                  serverVersion: meta.catalog_version,
                  clientVersion: CATALOG_VERSION,
                })}
              </span>
            </div>
          ) : null}

          {conflict ? (
            <div className="rv-banner rv-banner--conflict" role="alert">
              <div className="rv-field-header">
                <WarningCircle weight="regular" />
                <strong>{formatRecordMessage(locale, 'conflictTitle')}</strong>
              </div>
              <span>{formatRecordMessage(locale, 'conflictDescription')}</span>
              {conflict.latestRecord?.modified ? (
                <span className="rv-field-help">
                  {formatRecordMessage(locale, 'conflictServerVersion', {
                    version: conflict.latestRecord.modified,
                  })}
                </span>
              ) : null}
              <div className="rv-banner-actions">
                <Button
                  size="small"
                  type="primary"
                  onClick={() => {
                    if (conflict.latestRecord) {
                      setScreenState({
                        status: 'ready',
                        meta,
                        record: conflict.latestRecord,
                      });
                    }
                    setConflict(null);
                  }}
                >
                  {formatRecordMessage(locale, 'conflictKeepDraft')}
                </Button>
                {conflict.latestRecord ? (
                  <Button
                    size="small"
                    onClick={() => {
                      if (conflict.latestRecord) {
                        setScreenState({
                          status: 'ready',
                          meta,
                          record: conflict.latestRecord,
                        });
                      }
                      setDraftEdits({});
                      setFieldErrors({});
                      setConflict(null);
                    }}
                  >
                    {formatRecordMessage(locale, 'conflictReloadServer')}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div role="status" aria-live="polite" aria-atomic="true">
            {Object.keys(fieldErrors).length > 0 ? (
              <p key={validationAttempt.sequence} className="rv-banner rv-banner--error">
                {formatRecordMessage(locale, 'validationErrorCount', {
                  count: Object.keys(fieldErrors).length,
                })}
              </p>
            ) : null}
          </div>

          {actionError ? (
            <div className="rv-banner rv-banner--error" role="alert">
              <span>{actionError}</span>
            </div>
          ) : null}

          {layout.hasExplicitTabs ? (
            <Tabs
              {...(activeTabKey !== undefined ? { activeKey: activeTabKey } : {})}
              onChange={(nextKey) => setActiveTabKey(nextKey)}
              items={layout.tabs.map((tab) => ({
                key: tab.key,
                label: tab.label,
                children: <div className="rv-column">{renderSections(tab.sections)}</div>,
              }))}
            />
          ) : (
            layout.tabs.map((tab) => (
              <div key={tab.key} className="rv-column">
                {renderSections(tab.sections)}
              </div>
            ))
          )}
        </div>
      </HelpDoctype.Provider>
    </form>
  );
}

export function RecordView(props: RecordViewProps) {
  const themeMode: RecordThemeMode = props.themeMode ?? 'light';
  const locale: RecordLocale = props.locale ?? 'tr';
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isKeyboardModality = useKeyboardFocusModality();
  const isPhoneContainer = useIsPhoneContainer(rootRef);
  const [boundaryResetCount, setBoundaryResetCount] = useState(0);

  const antdThemeConfig = useMemo(() => buildRecordAntdTheme(themeMode), [themeMode]);
  const cssVars = useMemo(() => buildRecordCssVariables(themeMode), [themeMode]);

  const recordIdentityKey = `${props.doctype}::${props.createMode ? '__new__' : (props.name ?? '__empty__')}::${locale}::${boundaryResetCount}`;

  return (
    <ConfigProvider theme={antdThemeConfig}>
      <div
        ref={rootRef}
        className="rv-root"
        data-theme={themeMode}
        data-rv-viewport={isPhoneContainer ? 'phone' : 'wide'}
        data-rv-kbd={isKeyboardModality ? 'true' : 'false'}
        style={cssVars}
      >
        <RecordErrorBoundary
          locale={locale}
          resetKey={recordIdentityKey}
          onReset={() => setBoundaryResetCount((n) => n + 1)}
        >
          <RecordLinkProvider value={props.renderRecordLink}>
            <RecordViewBody key={recordIdentityKey} {...props} isPhoneViewport={isPhoneContainer} />
          </RecordLinkProvider>
        </RecordErrorBoundary>
      </div>
    </ConfigProvider>
  );
}
