import { CaretDown, Check } from '@phosphor-icons/react';
import { Button, Select } from 'antd';
import { Input } from '@/components/controls';
import type { ButtonProps, InputProps, InputRef, RefSelectProps, SelectProps } from 'antd';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

function subscribeMotion(callback: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
function getReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const pointerState: { x: number | null; y: number | null; moved: boolean } = {
  x: null,
  y: null,
  moved: false,
};
let pointerListeners = 0;

function resetPointerMotion(event: MouseEvent | PointerEvent) {
  pointerState.x = event.clientX;
  pointerState.y = event.clientY;
  pointerState.moved = false;
}
function clearPointerMotion() {
  pointerState.moved = false;
}
function trackMouseMove(event: MouseEvent) {
  const moved =
    pointerState.x === null || pointerState.y === null
      ? event.clientX !== 0 || event.clientY !== 0
      : Math.hypot(event.clientX - pointerState.x, event.clientY - pointerState.y) > 1;
  pointerState.x = event.clientX;
  pointerState.y = event.clientY;
  pointerState.moved = moved;
}
function subscribePointerMotion() {
  pointerListeners += 1;
  if (pointerListeners === 1) {
    document.addEventListener('pointerdown', resetPointerMotion, true);
    document.addEventListener('mousedown', resetPointerMotion, true);
    document.addEventListener('touchstart', clearPointerMotion, true);
    document.addEventListener('keydown', clearPointerMotion, true);
    document.addEventListener('mousemove', trackMouseMove, true);
  }
  return () => {
    pointerListeners -= 1;
    if (pointerListeners === 0) {
      document.removeEventListener('pointerdown', resetPointerMotion, true);
      document.removeEventListener('mousedown', resetPointerMotion, true);
      document.removeEventListener('touchstart', clearPointerMotion, true);
      document.removeEventListener('keydown', clearPointerMotion, true);
      document.removeEventListener('mousemove', trackMouseMove, true);
      pointerState.x = null;
      pointerState.y = null;
      pointerState.moved = false;
    }
  };
}

/** Public antd APIs only. Shared foundation engines own hit geometry and focus mode. */
export function CollectionButton(props: ButtonProps) {
  return <Button {...props} className="collection-button collection-hit" />;
}
export function CollectionInput(props: InputProps) {
  const input = useRef<InputRef>(null);
  return (
    <Input
      {...props}
      ref={input}
      className="collection-input collection-hit"
      classNames={{ input: 'collection-input-field', suffix: 'collection-input-suffix' }}
      suffix={<span aria-hidden />}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          input.current?.focus();
        }
      }}
    />
  );
}
export function CollectionSelect<Value extends string | number>(props: SelectProps<Value>) {
  const { popupRender, ...selectProps } = props;
  const select = useRef<RefSelectProps>(null);
  const [open, setOpen] = useState(false);
  useEffect(subscribePointerMotion, []);
  useLayoutEffect(() => {
    // Touch can move the popup beneath the pointer between down and click.
    // Focus on opening, independent of where that click ultimately lands.
    if (open && !selectProps.disabled) select.current?.focus();
  }, [open, selectProps.disabled]);
  const reducedMotion = useSyncExternalStore(subscribeMotion, getReducedMotion, () => false);
  return (
    <Select<Value>
      {...selectProps}
      ref={select}
      open={open}
      onOpenChange={setOpen}
      classNames={{ root: 'collection-select collection-hit', popup: { root: 'collection-popup' } }}
      styles={{ popup: { root: { boxShadow: 'var(--shadow-dropdown)', padding: 0 } } }}
      suffixIcon={<CaretDown weight="regular" aria-hidden />}
      menuItemSelectedIcon={<Check weight="regular" aria-hidden />}
      dropdownAlign={{ offset: [0, 0] }}
      virtual={false}
      getPopupContainer={(trigger) =>
        (trigger.closest('.collection') as HTMLElement | null) ?? trigger
      }
      popupRender={(menu) => (
        <div
          onMouseMoveCapture={(event) => {
            // Mobile WebKit dispatches a synthetic mousemove at the last tap coordinate
            // after auto-scrolling a focused combobox, which would reset ArrowDown's active option.
            if (!pointerState.moved) event.stopPropagation();
          }}
        >
          {popupRender ? popupRender(menu) : menu}
        </div>
      )}
      transitionName={reducedMotion ? '' : 'collection-dropdown'}
      onMouseDown={(event) => {
        // The expanded ring targets the root. Use the public ref and controlled state.
        if (event.target === event.currentTarget && !selectProps.disabled) {
          event.preventDefault();
          select.current?.focus();
          setOpen((value) => !value);
        }
      }}
    />
  );
}
