import {
  Barcode as BarcodeIcon,
  Crosshair,
  Eraser,
  ImageSquare,
  Lightning,
  Trash,
  UploadSimple,
} from '@phosphor-icons/react';
import { Button, ColorPicker, InputNumber, Rate, Segmented, Upload } from 'antd';
import { Input } from '@/components/controls';
import { type PointerEvent, useCallback, useEffect, useRef, useState } from 'react';

import { formatRecordMessage } from '../messages';
import type { DocField, RecordLocale } from '../types';
import type { FieldControlA11yProps } from './FieldShell';

function isSafeAttachmentUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (trimmed.startsWith('/files/') || trimmed.startsWith('/private/files/')) {
    return !trimmed.startsWith('//');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface AttachFieldProps {
  value: string | null | undefined;
  isImage: boolean;
  readOnly: boolean;
  locale: RecordLocale;
  a11y: FieldControlA11yProps;
  onChange: (nextValue: string | null) => void;
}

export function AttachField(props: AttachFieldProps) {
  const { value, isImage, readOnly, locale, a11y, onChange } = props;
  const filePath = typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  const safeUrl = filePath ? isSafeAttachmentUrl(filePath) : false;
  const actionTextId = `${a11y.controlId}-action-text`;

  return (
    <div className="rv-signature-pad">
      <div className="rv-attach-row">
        {!readOnly ? (
          <Upload
            {...(isImage ? { accept: 'image/*' } : {})}
            showUploadList={false}
            beforeUpload={(file) => {
              const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
              onChange(`/files/${sanitizedName}`);
              return false;
            }}
          >
            <Button
              id={a11y.controlId}
              aria-labelledby={`${a11y.labelId} ${actionTextId}`}
              aria-describedby={a11y.ariaDescribedBy}
              size="middle"
              icon={isImage ? <ImageSquare weight="regular" /> : <UploadSimple weight="regular" />}
            >
              <span id={actionTextId}>
                {formatRecordMessage(locale, isImage ? 'attachChooseImage' : 'attachChooseFile')}
              </span>
            </Button>
          </Upload>
        ) : null}

        {filePath ? (
          safeUrl ? (
            <span className="rv-pill rv-pill--neutral">{filePath}</span>
          ) : (
            <span className="rv-pill rv-pill--warning">
              {formatRecordMessage(locale, 'attachUnsafeUrlBlocked')}
            </span>
          )
        ) : readOnly ? (
          <span className="rv-readonly-box" role="textbox" aria-readonly="true">
            {formatRecordMessage(locale, 'readOnlyEmpty')}
          </span>
        ) : null}

        {filePath && !readOnly ? (
          <Button
            size="middle"
            type="text"
            danger
            icon={<Trash weight="regular" />}
            aria-label={formatRecordMessage(locale, 'attachClearFile')}
            onClick={() => onChange(null)}
          />
        ) : null}
      </div>

      {isImage && filePath && safeUrl ? (
        <img src={filePath} alt="" className="rv-attach-preview" />
      ) : null}
    </div>
  );
}

interface StrokePoint {
  x: number;
  y: number;
}

interface SignatureThemeTokens {
  strokeColor: string;
  strokeWidth: number;
  fontFamily: string;
  fontSizePx: number;
  paddingXPx: number;
  defaultWidthPx: number;
  defaultHeightPx: number;
}

function parseTokenPx(raw: string, fallback: number): number {
  const num = Number.parseFloat(raw);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function readSignatureThemeTokens(element: HTMLElement | null): SignatureThemeTokens {
  if (!element || typeof window === 'undefined') {
    return {
      strokeColor: 'currentColor',
      strokeWidth: 2,
      fontFamily: 'sans-serif',
      fontSizePx: 28,
      paddingXPx: 16,
      defaultWidthPx: 288,
      defaultHeightPx: 120,
    };
  }
  const computed = window.getComputedStyle(element);
  const baseBodyPx = parseTokenPx(computed.fontSize, 14);
  return {
    strokeColor: computed.color || 'currentColor',
    strokeWidth: parseTokenPx(computed.getPropertyValue('--rv-focus-line-size'), 2),
    fontFamily: computed.fontFamily || 'sans-serif',
    fontSizePx: parseTokenPx(computed.getPropertyValue('--rv-signature-font-size'), baseBodyPx * 2),
    paddingXPx: parseTokenPx(computed.getPropertyValue('--rv-signature-pad-x'), baseBodyPx),
    defaultWidthPx: Math.round(
      parseTokenPx(computed.getPropertyValue('--rv-signature-w'), baseBodyPx * 20),
    ),
    defaultHeightPx: Math.round(
      parseTokenPx(computed.getPropertyValue('--rv-signature-h'), baseBodyPx * 8),
    ),
  };
}

export interface SignatureFieldProps {
  value: string | null | undefined;
  readOnly: boolean;
  locale: RecordLocale;
  a11y: FieldControlA11yProps;
  onChange: (nextValue: string | null) => void;
}

export function SignatureField(props: SignatureFieldProps) {
  const { value, readOnly, locale, a11y, onChange } = props;
  const padRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [signMode, setSignMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');

  // Review 2 Finding 2: Accumulate all strokes instead of resetting on each pointerdown.
  const strokesRef = useRef<StrokePoint[][]>([]);
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  const hasSignature = typeof value === 'string' && value.startsWith('data:image/');

  const redrawAllStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    let ctx: CanvasRenderingContext2D | null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) {
      return;
    }
    const dpr =
      typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
    const { width, height } = sizeRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    const tokens = readSignatureThemeTokens(canvas);
    ctx.strokeStyle = tokens.strokeColor;
    ctx.lineWidth = tokens.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of strokesRef.current) {
      if (stroke.length === 0) {
        continue;
      }
      const first = stroke[0];
      if (!first) {
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      if (stroke.length === 1) {
        ctx.lineTo(first.x + 0.5, first.y + 0.5);
      } else {
        for (let i = 1; i < stroke.length; i += 1) {
          const pt = stroke[i];
          if (pt) {
            ctx.lineTo(pt.x, pt.y);
          }
        }
      }
      ctx.stroke();
    }

    if (width <= 0 || height <= 0) {
      return;
    }
  }, []);

  // Review 2 Finding 3: Synchronize backing bitmap with actual rendered CSS size + devicePixelRatio.
  const syncCanvasDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') {
      return;
    }
    const tokens = readSignatureThemeTokens(canvas);
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width > 0 ? Math.round(rect.width) : tokens.defaultWidthPx;
    const cssHeight = rect.height > 0 ? Math.round(rect.height) : tokens.defaultHeightPx;
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(cssWidth * dpr);
    const targetH = Math.round(cssHeight * dpr);

    sizeRef.current = { width: cssWidth, height: cssHeight };
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      redrawAllStrokes();
    }
  }, [redrawAllStrokes]);

  // Review 3 Minor 3: Bind ResizeObserver in the canvas callback ref so remounting after mode switch is observed.
  const setCanvasElement = useCallback(
    (node: HTMLCanvasElement | null) => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      canvasRef.current = node;

      if (!node) {
        return;
      }
      syncCanvasDimensions();
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
          syncCanvasDimensions();
        });
        observer.observe(node);
        resizeObserverRef.current = observer;
      }
    },
    [syncCanvasDimensions],
  );

  useEffect(() => {
    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
  }, []);

  const serializeStrokes = (): string => {
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const pngUrl = canvas.toDataURL('image/png');
          if (pngUrl.startsWith('data:image/png') && pngUrl.length > 32) {
            return pngUrl;
          }
        }
      } catch {
        // Fall through to multi-stroke SVG in headless jsdom environments.
      }
    }
    const tokens = readSignatureThemeTokens(canvas ?? padRef.current);
    const width = sizeRef.current.width > 0 ? sizeRef.current.width : tokens.defaultWidthPx;
    const height = sizeRef.current.height > 0 ? sizeRef.current.height : tokens.defaultHeightPx;
    const pathD = strokesRef.current
      .filter((stroke) => stroke.length > 0)
      .map((stroke) => stroke.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' '))
      .join(' ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${pathD}" stroke="${tokens.strokeColor}" stroke-width="${tokens.strokeWidth}" fill="none"/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const getRelativePoint = (event: PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.round(event.clientX - rect.left),
      y: Math.round(event.clientY - rect.top),
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (readOnly) {
      return;
    }
    syncCanvasDimensions();
    const pt = getRelativePoint(event);
    strokesRef.current = [...strokesRef.current, [pt]];
    setDrawing(true);
    redrawAllStrokes();
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing || readOnly) {
      return;
    }
    const pt = getRelativePoint(event);
    const currentStrokes = strokesRef.current;
    const activeStroke = currentStrokes[currentStrokes.length - 1];
    if (activeStroke) {
      activeStroke.push(pt);
    }
    redrawAllStrokes();
  };

  const handlePointerUp = () => {
    if (!drawing || readOnly) {
      return;
    }
    setDrawing(false);
    if (strokesRef.current.length === 0) {
      return;
    }
    onChange(serializeStrokes());
  };

  // Review 3 Minor 1 & Minor 2: Render typed signature onto an offscreen canvas with token font/padding to produce PNG.
  const handleApplyTypedSignature = () => {
    const cleanText = typedName.trim();
    if (!cleanText || readOnly) {
      return;
    }
    const tokens = readSignatureThemeTokens(padRef.current);
    const padWidth = padRef.current ? Math.round(padRef.current.getBoundingClientRect().width) : 0;
    const width =
      padWidth > 0
        ? padWidth
        : sizeRef.current.width > 0
          ? sizeRef.current.width
          : tokens.defaultWidthPx;
    const height = tokens.defaultHeightPx;

    if (typeof document !== 'undefined') {
      try {
        const offscreen = document.createElement('canvas');
        const dpr =
          typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
        offscreen.width = Math.round(width * dpr);
        offscreen.height = Math.round(height * dpr);
        const ctx = offscreen.getContext('2d');
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, offscreen.width, offscreen.height);
          ctx.scale(dpr, dpr);
          ctx.fillStyle = tokens.strokeColor;
          ctx.font = `italic ${tokens.fontSizePx}px ${tokens.fontFamily}`;
          ctx.textBaseline = 'middle';
          ctx.fillText(cleanText, tokens.paddingXPx, Math.round(height / 2));
          const png = offscreen.toDataURL('image/png');
          if (png.startsWith('data:image/png') && png.length > 32) {
            onChange(png);
            return;
          }
        }
      } catch {
        // Fall through to safe SVG text serialization in jsdom.
      }
    }

    const escapedText = cleanText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><text x="${tokens.paddingXPx}" y="${Math.round(height / 2)}" fill="${tokens.strokeColor}" font-size="${tokens.fontSizePx}" font-style="italic">${escapedText}</text></svg>`;
    onChange(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
  };

  const clearCanvasPixels = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        const ctx = canvas.getContext('2d');
        ctx?.setTransform(1, 0, 0, 1, 0, 0);
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      } catch {
        // Ignore in non-canvas environments.
      }
    }
  };

  const handleModeChange = (nextMode: 'draw' | 'type') => {
    strokesRef.current = [];
    setDrawing(false);
    clearCanvasPixels();
    setSignMode(nextMode);
  };

  const handleClear = () => {
    strokesRef.current = [];
    setTypedName('');
    clearCanvasPixels();
    onChange(null);
  };

  return (
    <div ref={padRef} className="rv-signature-pad">
      {!readOnly ? (
        <div className="rv-editor-toolbar">
          <Segmented<'draw' | 'type'>
            size="small"
            value={signMode}
            onChange={handleModeChange}
            options={[
              { value: 'draw', label: formatRecordMessage(locale, 'signatureModeDraw') },
              { value: 'type', label: formatRecordMessage(locale, 'signatureModeType') },
            ]}
          />
        </div>
      ) : null}

      {!readOnly && signMode === 'draw' ? (
        <canvas
          id={a11y.controlId}
          ref={setCanvasElement}
          role="img"
          aria-labelledby={a11y.labelId}
          aria-describedby={a11y.ariaDescribedBy}
          className="rv-signature-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      ) : !readOnly && signMode === 'type' ? (
        <>
          <div className="rv-attach-row">
            <Input
              id={a11y.controlId}
              aria-label={formatRecordMessage(locale, 'signatureTextLabel')}
              size="middle"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
            />
            <Button
              size="middle"
              onClick={handleApplyTypedSignature}
              disabled={typedName.trim().length === 0}
            >
              {formatRecordMessage(locale, 'signatureApplyAction')}
            </Button>
          </div>
          {hasSignature ? <img src={value} alt="" className="rv-attach-preview" /> : null}
        </>
      ) : hasSignature ? (
        <img src={value} alt="" className="rv-attach-preview" />
      ) : null}

      <div className="rv-attach-row">
        <span className={hasSignature ? 'rv-pill rv-pill--primary' : 'rv-pill rv-pill--neutral'}>
          {formatRecordMessage(
            locale,
            hasSignature ? 'signatureSignedBadge' : 'signatureEmptyBadge',
          )}
        </span>
        {!readOnly ? (
          <>
            {signMode === 'draw' ? (
              <span className="rv-field-help">
                {formatRecordMessage(locale, 'signatureDrawHint')}
              </span>
            ) : null}
            {hasSignature ? (
              <Button size="small" icon={<Eraser weight="regular" />} onClick={handleClear}>
                {formatRecordMessage(locale, 'signatureClear')}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

interface ParsedCoordinates {
  lat: number | null;
  lng: number | null;
}

function parseGeoJsonPoint(raw: unknown): ParsedCoordinates {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { lat: null, lng: null };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { lat: null, lng: null };
    }
    const obj = parsed as Record<string, unknown>;
    if (obj['type'] === 'FeatureCollection' && Array.isArray(obj['features'])) {
      const first: unknown = obj['features'][0];
      if (typeof first === 'object' && first !== null) {
        const geom = (first as Record<string, unknown>)['geometry'];
        if (typeof geom === 'object' && geom !== null) {
          const coords = (geom as Record<string, unknown>)['coordinates'];
          if (
            Array.isArray(coords) &&
            typeof coords[0] === 'number' &&
            typeof coords[1] === 'number'
          ) {
            return { lng: coords[0], lat: coords[1] };
          }
        }
      }
    }
  } catch {
    return { lat: null, lng: null };
  }
  return { lat: null, lng: null };
}

function formatGeoJsonPoint(lat: number | null, lng: number | null): string | null {
  if (lat === null && lng === null) {
    return null;
  }
  const safeLat = lat ?? 0;
  const safeLng = lng ?? 0;
  return JSON.stringify({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [safeLng, safeLat],
        },
      },
    ],
  });
}

export interface GeolocationFieldProps {
  value: unknown;
  readOnly: boolean;
  locale: RecordLocale;
  a11y: FieldControlA11yProps;
  onChange: (nextValue: string | null) => void;
}

export function GeolocationField(props: GeolocationFieldProps) {
  const { value, readOnly, locale, a11y, onChange } = props;
  const { lat, lng } = parseGeoJsonPoint(value);
  const [geoError, setGeoError] = useState<string | null>(null);
  const latId = `${a11y.controlId}-lat`;
  const lngId = `${a11y.controlId}-lng`;

  return (
    <div className="rv-signature-pad">
      <div className="rv-geo-grid">
        <div className="rv-field">
          <label htmlFor={latId} className="rv-field-help">
            {formatRecordMessage(locale, 'geolocationLatitude')}
          </label>
          <InputNumber<number>
            id={latId}
            size="middle"
            style={{ width: '100%' }}
            min={-90}
            max={90}
            step={0.0001}
            disabled={readOnly}
            value={lat}
            onChange={(nextLat) => {
              setGeoError(null);
              onChange(formatGeoJsonPoint(typeof nextLat === 'number' ? nextLat : null, lng));
            }}
          />
        </div>
        <div className="rv-field">
          <label htmlFor={lngId} className="rv-field-help">
            {formatRecordMessage(locale, 'geolocationLongitude')}
          </label>
          <InputNumber<number>
            id={lngId}
            size="middle"
            style={{ width: '100%' }}
            min={-180}
            max={180}
            step={0.0001}
            disabled={readOnly}
            value={lng}
            onChange={(nextLng) => {
              setGeoError(null);
              onChange(formatGeoJsonPoint(lat, typeof nextLng === 'number' ? nextLng : null));
            }}
          />
        </div>
      </div>
      {!readOnly && typeof navigator !== 'undefined' && 'geolocation' in navigator ? (
        <div>
          <Button
            size="small"
            icon={<Crosshair weight="regular" />}
            onClick={() => {
              setGeoError(null);
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  onChange(formatGeoJsonPoint(pos.coords.latitude, pos.coords.longitude));
                },
                () => {
                  setGeoError(formatRecordMessage(locale, 'geolocationPermissionDenied'));
                },
              );
            }}
          >
            {formatRecordMessage(locale, 'geolocationUseCurrent')}
          </Button>
        </div>
      ) : null}
      {geoError ? (
        <p className="rv-field-error" role="alert">
          {geoError}
        </p>
      ) : null}
    </div>
  );
}

export interface BarcodeFieldProps {
  value: string;
  readOnly: boolean;
  locale: RecordLocale;
  a11y: FieldControlA11yProps;
  onChange: (nextValue: string) => void;
}

export function BarcodeField(props: BarcodeFieldProps) {
  const { value, readOnly, locale, a11y, onChange } = props;
  const trimmed = value.trim();

  const barWidths: number[] = [];
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    barWidths.push((code % 3) + 1, ((code >> 2) % 3) + 1);
  }

  let cursorX = 4;

  return (
    <div className="rv-signature-pad">
      <Input
        id={a11y.controlId}
        aria-labelledby={a11y.labelId}
        aria-describedby={a11y.ariaDescribedBy}
        aria-invalid={a11y.ariaInvalid}
        size="middle"
        readOnly={readOnly}
        prefix={<BarcodeIcon weight="regular" />}
        placeholder={formatRecordMessage(locale, 'barcodePlaceholder')}
        style={{ fontFamily: 'var(--rv-font-mono)' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {trimmed.length > 0 ? (
        <div className="rv-barcode-preview" aria-hidden="true">
          <svg
            width={Math.max(120, barWidths.length * 4 + 12)}
            height={36}
            viewBox={`0 0 ${Math.max(120, barWidths.length * 4 + 12)} 36`}
          >
            {barWidths.map((w, idx) => {
              const x = cursorX;
              cursorX += w + 2;
              return <rect key={idx} x={x} y={2} width={w} height={32} fill="currentColor" />;
            })}
          </svg>
        </div>
      ) : null}
    </div>
  );
}

export interface ColorFieldProps {
  value: string;
  readOnly: boolean;
  locale: RecordLocale;
  a11y: FieldControlA11yProps;
  onChange: (nextValue: string) => void;
}

export function ColorField(props: ColorFieldProps) {
  const { value, readOnly, locale, a11y, onChange } = props;
  const hasValidHex = /^#[0-9a-fA-F]{6}$/.test(value.trim());

  return (
    <div className="rv-color-row">
      <ColorPicker
        disabled={readOnly}
        allowClear
        value={hasValidHex ? value.trim() : null}
        onClear={() => onChange('')}
        onChange={(_color, cssHex) => onChange(cssHex)}
      />
      <Input
        id={a11y.controlId}
        aria-labelledby={a11y.labelId}
        aria-describedby={a11y.ariaDescribedBy}
        aria-invalid={a11y.ariaInvalid}
        size="middle"
        readOnly={readOnly}
        className="rv-color-input"
        placeholder={formatRecordMessage(locale, 'colorPlaceholder')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export interface RatingFieldProps {
  field: DocField;
  value: unknown;
  readOnly: boolean;
  a11y: FieldControlA11yProps;
  onChange: (nextValue: number) => void;
}

export function RatingField(props: RatingFieldProps) {
  const { field, value, readOnly, a11y, onChange } = props;
  const parsedCount = field.options ? Number.parseInt(field.options, 10) : 5;
  const starCount =
    Number.isInteger(parsedCount) && parsedCount >= 3 && parsedCount <= 10 ? parsedCount : 5;
  const numericVal = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  const displayedStars = numericVal <= 1 ? numericVal * starCount : Math.min(starCount, numericVal);

  // Review 2 Minor 3: Bind label and accessible name directly onto the Rate element (not a wrapper div).
  return (
    <Rate
      id={a11y.controlId}
      aria-labelledby={a11y.labelId}
      aria-describedby={a11y.ariaDescribedBy}
      allowHalf
      count={starCount}
      disabled={readOnly}
      value={displayedStars}
      onChange={(stars) => {
        const normalized = Math.round((stars / starCount) * 1000) / 1000;
        onChange(normalized);
      }}
    />
  );
}

export interface ButtonFieldProps {
  field: DocField;
  disabled: boolean;
  onAction?: ((field: DocField) => void) | undefined;
}

export function ButtonField(props: ButtonFieldProps) {
  const { field, disabled, onAction } = props;
  return (
    <div>
      <Button
        size="middle"
        type="default"
        icon={<Lightning weight="regular" />}
        disabled={disabled}
        onClick={() => onAction?.(field)}
      >
        {field.label ?? field.fieldname}
      </Button>
    </div>
  );
}
