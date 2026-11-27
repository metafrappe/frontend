import { t } from '../messages';

interface RailToggleProps {
  rail: boolean;
  onToggle: () => void;
}

/** RT2–RT3: 2D SVG toggle in the header. The divider slides, the arrow rotates. */
export function RailToggle({ rail, onToggle }: RailToggleProps) {
  const label = rail ? t.nav.toSolid : t.nav.toRail;
  return (
    <button
      type="button"
      className="shell-tg"
      data-rail={rail ? 'true' : 'false'}
      aria-pressed={rail}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <g className="shell-tg-div">
          <line x1="9" y1="4" x2="9" y2="20" stroke="currentColor" strokeWidth="1.5" />
        </g>
        <path
          className="shell-tg-chev"
          d="M15.5 9.5 13 12l2.5 2.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
