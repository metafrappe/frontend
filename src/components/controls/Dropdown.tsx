import { CaretDown, Check } from '@phosphor-icons/react';
import { ConfigProvider, Dropdown as AntDropdown, Space } from 'antd';
import type { DropdownProps as AntDropdownProps, MenuProps } from 'antd';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { flushSync } from 'react-dom';

import { useThemeMode } from '@/app';
import { useFormat, useMessage } from '@/app/locale';
import { danger as dangerTokens } from '@/design';

import { groupDropdownItems } from './dropdown-items';
import { Input } from './FormControls';
import { Button } from './SurfaceControls';

export type DropdownStyle = 'classic' | 'shortcut' | 'described' | 'selectable' | 'searchable';

export interface DropdownItem {
  key: string;
  label: string;
  icon?: ReactNode;
  description?: string;
  shortcut?: string;
  group?: string;
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownProps {
  label: string;
  items: readonly DropdownItem[];
  style?: DropdownStyle;
  selectedKey?: string;
  searchLabel?: string;
  onSelect: (key: string) => void;
}

export interface SplitDropdownProps extends DropdownProps {
  menuLabel: string;
  onAction: () => void;
}

type MenuItems = NonNullable<MenuProps['items']>;

type OverflowAdjust = Exclude<NonNullable<AntDropdownProps['autoAdjustOverflow']>, boolean>;
// antd merges `shiftY` into the rc-trigger overflow options; its public type lists only the flips.
const overflowAdjust = { adjustX: 1, adjustY: 1, shiftY: true } as OverflowAdjust;

function ActionDropdown({
  label,
  items,
  style = 'classic',
  selectedKey,
  searchLabel = 'Menüde ara',
  onSelect,
  menuLabel,
  onAction,
}: DropdownProps & Partial<Pick<SplitDropdownProps, 'menuLabel' | 'onAction'>>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerId = useId();
  const popupId = useId();
  const restoreFocus = useRef(false);
  const { resolved } = useThemeMode();
  const format = useFormat();
  const m = useMessage();
  const menuItemSelector =
    ':is([role="menuitem"], [role="menuitemradio"]):not([aria-disabled="true"])';

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const popup = document.getElementById(`${popupId}-surface`);
      // On a slow device the person can already be inside the popup before this frame runs, for
      // example after typing in the search box and pressing an arrow. Opening focus must not
      // take that focus back.
      if (!popup || popup.contains(document.activeElement)) return;
      popup
        .querySelector<HTMLElement>(style === 'searchable' ? 'input' : menuItemSelector)
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, popupId, style]);

  // A closed menu leaves the accessibility tree and the tab order at once, while its motion runs.
  // The popup freezes its content during the leave motion, so the attributes are written here.
  useLayoutEffect(() => {
    const surface = document.getElementById(`${popupId}-surface`);
    if (!surface) return;
    if (open) {
      surface.removeAttribute('aria-hidden');
      surface.removeAttribute('inert');
    } else {
      surface.setAttribute('aria-hidden', 'true');
      surface.setAttribute('inert', '');
    }
  }, [open, popupId]);

  useLayoutEffect(() => {
    if (!open && restoreFocus.current) {
      restoreFocus.current = false;
      document.getElementById(triggerId)?.focus();
    }
  }, [open, triggerId]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  useEffect(() => {
    if (!open) return;

    function dismiss(event: KeyboardEvent) {
      const target = event.target;
      const popup = document.getElementById(`${popupId}-surface`);
      const insideDropdown =
        target instanceof Node &&
        (document.getElementById(triggerId)?.contains(target) || popup?.contains(target));
      if (event.key === 'Escape' && insideDropdown) {
        event.preventDefault();
        event.stopPropagation();
        restoreFocus.current = true;
        close();
      }
    }

    window.addEventListener('keydown', dismiss, true);
    return () => window.removeEventListener('keydown', dismiss, true);
  }, [open, popupId, triggerId]);

  const { regular, danger } = groupDropdownItems(items, query, style === 'shortcut', format.intl);

  function handlePopupKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Tab') {
      // Skip rc-dropdown's Tab handler so it cannot cancel native navigation.
      event.stopPropagation();
      document.getElementById(triggerId)?.focus();
      // Remove the popup from the tab order before the browser handles this key.
      flushSync(close);
      return;
    }
    if (event.target instanceof HTMLInputElement && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      const options = event.currentTarget.querySelectorAll<HTMLElement>(menuItemSelector);
      const option = event.key === 'ArrowDown' ? options.item(0) : options.item(options.length - 1);
      if (option) {
        event.preventDefault();
        option.focus();
      }
    } else if (event.key === ' ' && event.target instanceof HTMLElement) {
      const option = event.target.closest<HTMLElement>(menuItemSelector);
      if (option) {
        event.preventDefault();
        option.click();
      }
    }
  }

  function buildItem(item: DropdownItem): MenuItems[number] {
    return {
      key: item.key,
      disabled: item.disabled ?? false,
      ...(style === 'selectable'
        ? { role: 'menuitemradio', 'aria-checked': selectedKey === item.key }
        : {}),
      icon: item.icon,
      danger: item.danger ?? false,
      label: (
        <Space direction={style === 'described' ? 'vertical' : 'horizontal'} size={0}>
          <span>{item.label}</span>
          {style === 'described' && item.description && <small>{item.description}</small>}
          {style === 'shortcut' && item.shortcut && <kbd>{item.shortcut}</kbd>}
          {style === 'selectable' && selectedKey === item.key && <Check aria-hidden />}
        </Space>
      ),
    };
  }

  const menuItems: MenuItems = [];
  for (const [group, entries] of regular) {
    if (menuItems.length > 0) menuItems.push({ type: 'divider' });
    if (group) menuItems.push({ type: 'group', label: group, children: entries.map(buildItem) });
    else menuItems.push(...entries.map(buildItem));
  }
  if (menuItems.length > 0 && danger.length > 0) menuItems.push({ type: 'divider' });
  menuItems.push(...danger.map(buildItem));

  const dangerColor = dangerTokens[resolved];
  const dropdown = (
    // Foundation decision 13: danger items use the darkened red that gives white text 4.5:1.
    <ConfigProvider
      theme={{
        components: {
          Dropdown: {
            colorError: dangerColor.background,
            colorTextLightSolid: dangerColor.solidText,
          },
        },
      }}
    >
      <AntDropdown
        open={open}
        align={{ offset: [0, 0] }}
        // Flip first; if neither side fits (landscape phone), shift the panel into the viewport.
        autoAdjustOverflow={overflowAdjust}
        placement={onAction ? 'bottomRight' : 'bottomLeft'}
        overlayClassName={`atonota-dropdown-popup atonota-control-popup atonota-dropdown-${style}`}
        transitionName="atonota-popup-motion"
        trigger={['click']}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        menu={{
          id: popupId,
          items: menuItems,
          selectable: style === 'selectable',
          selectedKeys: selectedKey === undefined ? [] : [selectedKey],
          onClick: ({ key, domEvent }) => {
            // Focus returns to the trigger before the key's default action runs. Without this,
            // the same Enter would press the trigger and open the menu again.
            if (domEvent.type === 'keydown') domEvent.preventDefault();
            restoreFocus.current = true;
            close();
            onSelect(key);
          },
        }}
        popupRender={(menu) => (
          <div id={`${popupId}-surface`} onKeyDown={handlePopupKey}>
            {style === 'searchable' && (
              <Input
                aria-label={searchLabel}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            )}
            {menu}
            {menuItems.length === 0 && <p role="status">{m('controls.dropdown.noResults')}</p>}
          </div>
        )}
      >
        <Button
          id={triggerId}
          className="atonota-dropdown-trigger"
          aria-label={menuLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? popupId : undefined}
        >
          {onAction ? <CaretDown aria-hidden /> : label}
        </Button>
      </AntDropdown>
    </ConfigProvider>
  );
  if (!onAction) return dropdown;

  return (
    <Space.Compact className="atonota-split-dropdown" data-open={open || undefined}>
      <Button onClick={onAction}>{label}</Button>
      {dropdown}
    </Space.Compact>
  );
}

export function Dropdown(props: DropdownProps) {
  return <ActionDropdown {...props} />;
}

export function SplitDropdown(props: SplitDropdownProps) {
  return <ActionDropdown {...props} />;
}
