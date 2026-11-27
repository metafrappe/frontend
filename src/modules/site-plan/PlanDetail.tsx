/**
 * Plan detail (AJA-1744). Design: AJA-1743, "Dar alanda plan ayrıntısının okuma sırası".
 *
 * Reading order at every width: name, distinguishing detail, price, select button, other features.
 * The card decides its layout from its own width (container query), not from the screen width.
 * The selection reports the stable plan identity. The display name never stands in for it.
 */
import { Alert } from 'antd';
import { useId, useState } from 'react';

import { useFormat } from '@/app/locale';
import { Button } from '@/components/controls';

import { useCopy } from '../messages';
import type { PlanDetailData, PlanFeatureValue } from './plan-types';
import './plan-detail.css';

/** In a narrow space only the first features are shown. The rest open with a real button. */
export const VISIBLE_FEATURES = 3;

type Format = ReturnType<typeof useFormat>;

/** Unit formatting falls back to "<number> <unit>" if `Intl` does not know the unit. */
function unit(
  format: Format,
  amount: number,
  name: string,
  options: Intl.NumberFormatOptions = {},
) {
  try {
    return format.number(amount, { ...options, style: 'unit', unit: name });
  } catch {
    return `${format.number(amount, options)} ${name}`;
  }
}

function FeatureValue({
  value,
  featureKey,
  format,
}: {
  value: PlanFeatureValue;
  featureKey: string;
  format: Format;
}) {
  if (value.kind === 'text') return <>{value.text}</>;
  if (value.kind === 'quantity')
    return (
      <span className="plan-nowrap" translate="no">
        {unit(format, value.amount, value.unit)}
      </span>
    );
  // The minus sign, both ends and the unit stay on one line. Example: "-20 … +60°C".
  const signed: Intl.NumberFormatOptions = { signDisplay: 'exceptZero' };
  return (
    // Numbers and a unit from `Intl`, not translatable copy.
    <span className="plan-nowrap" translate="no" data-testid={`plan-range-${featureKey}`}>
      {format.number(value.min, signed)} … {unit(format, value.max, value.unit, signed)}
    </span>
  );
}

/** Name without its distinguishing last part. The last part is written on its own line. */
function baseName(plan: PlanDetailData) {
  return plan.name.endsWith(plan.variant)
    ? plan.name.slice(0, plan.name.length - plan.variant.length).trimEnd()
    : plan.name;
}

export interface PlanDetailProps {
  plan: PlanDetailData;
  selected: boolean;
  /** Called with the plan identity, never with the display name. */
  onSelect: (planId: string) => void;
  /** Error from the last selection attempt. Shown in full below the select button. */
  error?: string | undefined;
}

export function PlanDetail({ plan, selected, onSelect, error }: PlanDetailProps) {
  const copy = useCopy();
  const format = useFormat();
  const id = useId();
  const titleId = `${id}-title`;
  const selectId = `${id}-select`;
  const errorId = `${id}-error`;
  const listId = `${id}-features`;
  const [expanded, setExpanded] = useState(false);
  const base = baseName(plan);
  const extra = plan.features.length > VISIBLE_FEATURES;
  const features = expanded ? plan.features : plan.features.slice(0, VISIBLE_FEATURES);
  const tax =
    plan.tax === 'included'
      ? copy.planTaxIncluded
      : plan.tax === 'excluded'
        ? copy.planTaxExcluded
        : copy.planTaxUnknown;

  return (
    <article
      className="plan-card"
      aria-labelledby={titleId}
      data-plan-id={plan.id}
      data-selected={selected || undefined}
    >
      <div className="plan-card__grid">
        <header className="plan-card__header">
          <h3 id={titleId} className="plan-card__title" lang={plan.nameLang}>
            {base !== plan.name && (
              <>
                <span className="plan-card__base">{base}</span>{' '}
              </>
            )}
            <span className="plan-card__variant">{plan.variant}</span>
          </h3>
          {(selected || plan.sample) && (
            <p className="plan-card__tags">
              {selected && <span className="plan-card__tag">{copy.planSelected}</span>}
              {plan.sample && <span className="plan-card__tag">{copy.planSample}</span>}
            </p>
          )}
        </header>
        <div className="plan-card__main">
          <p className="plan-card__summary">{plan.summary}</p>
          <p className="plan-card__price" data-testid="plan-price">
            <span className="plan-card__amount">
              {format.currency(plan.price.amount, plan.price.currency)}
            </span>{' '}
            <span>{plan.price.period === 'year' ? copy.planPerYear : copy.planPerMonth}</span>
          </p>
          <p className="plan-card__tax">{tax}</p>
          <Button
            className="plan-card__select"
            type={selected ? 'default' : 'primary'}
            aria-pressed={selected}
            aria-labelledby={`${selectId} ${titleId}`}
            aria-describedby={error ? errorId : undefined}
            onClick={() => onSelect(plan.id)}
          >
            <span id={selectId}>{copy.planSelect}</span>
          </Button>
          {error && (
            <Alert id={errorId} className="plan-card__error" type="error" message={error} />
          )}
        </div>
        <section className="plan-card__features" aria-label={copy.planFeatures}>
          <dl id={listId} className="plan-card__list">
            {features.map((feature) => (
              <div key={feature.key} className="plan-feature">
                <dt lang={feature.lang}>{feature.label}</dt>
                <dd>
                  <FeatureValue value={feature.value} featureKey={feature.key} format={format} />
                </dd>
              </div>
            ))}
          </dl>
          {extra && (
            <Button
              className="plan-card__toggle"
              aria-expanded={expanded}
              aria-controls={listId}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? copy.planShowFewerFeatures : copy.planShowAllFeatures}
            </Button>
          )}
        </section>
      </div>
    </article>
  );
}

export interface PlanComparisonProps {
  plans: readonly PlanDetailData[];
  /** Identity of the selected plan. */
  selectedId: string | null;
  onSelect: (planId: string) => void;
  /** Errors by plan identity. */
  errors?: Readonly<Record<string, string>>;
}

/** Plans side by side when there is room, one below the other when there is not. */
export function PlanComparison({ plans, selectedId, onSelect, errors }: PlanComparisonProps) {
  return (
    <div className="plan-comparison">
      {plans.map((plan) => (
        <PlanDetail
          key={plan.id}
          plan={plan}
          selected={plan.id === selectedId}
          onSelect={onSelect}
          error={errors?.[plan.id]}
        />
      ))}
    </div>
  );
}

/**
 * Place of the plan detail on the "Site and plan" page.
 * Plan data does not come from the server yet (AJA-1731, AJA-1732). Without data the slot keeps
 * today's "not available" text. Test data is never shown here.
 */
export function PlanSlot({ plans }: { plans: readonly PlanDetailData[] | undefined }) {
  const copy = useCopy();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!plans?.length) return <p>{copy.plansUnavailable}</p>;
  return <PlanComparison plans={plans} selectedId={selectedId} onSelect={setSelectedId} />;
}
