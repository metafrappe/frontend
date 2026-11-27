import config from '@design-source/control-size-config.json';
import { describe, expect, it } from 'vitest';

import { required, shellTokens } from './tokens';

describe('shellTokens', () => {
  it('sidebar ölçülerini kaynak dosyadan alır', () => {
    expect(shellTokens.sidebar.widthExpanded).toBe(config.sidebar.widthExpanded);
    expect(shellTokens.sidebar.widthCollapsed).toBe(config.sidebar.widthCollapsed);
    expect(shellTokens.sidebar.item.height).toBe(config.sidebar.item.height);
    expect(shellTokens.flyout.width).toBe(config.sidebar.flyout.width);
    expect(shellTokens.flyout.gap).toBe(config.sidebar.flyout.gap);
    expect(shellTokens.flyout.closeDelay).toBe(config.sidebar.flyout.closeDelay);
  });

  it('flyout açılış gecikmesini ve hareketini kaynak metinden çıkarır', () => {
    // F4: 60 ms opening. F6: 180 ms fade + 6 px shift.
    expect(shellTokens.flyout.openDelay).toBe(60);
    expect(shellTokens.flyout.duration).toBe(180);
    expect(shellTokens.flyout.shift).toBe(6);
  });

  it('rail anahtarı hareketini kaynak metinden çıkarır', () => {
    expect(shellTokens.rail.duration).toBe(520);
    expect(shellTokens.rail.easing).toBe('cubic-bezier(.65,0,.35,1)');
  });

  it('alt kart renklerini kaynak metinden çıkarır', () => {
    expect(shellTokens.footer.dark).toBe('#0C0C0F');
    expect(shellTokens.footer.light).toBe('#1B2230');
  });

  it('odak perdesi değerlerini kaynak dosyadan alır', () => {
    expect(shellTokens.focusDim.duration).toBe(config.focusDim.duration);
    expect(shellTokens.focusDim.light.opacity).toBe(config.focusDim.opacity);
    expect(shellTokens.focusDim.dark.color).toBe(config.focusDim.dark.color);
  });

  it('satır kutusu, rozet ve hareket değerlerini kaynaktan alır', () => {
    expect(shellTokens.lineHeightAdd).toBe(8);
    expect(shellTokens.fontLg).toBe(config.sizes.lg.button.fontSize);
    expect(shellTokens.tagHeight).toBe(config.choice.tagHeights[0]);
    expect(shellTokens.ddBox).toBe(32);
    expect(shellTokens.motion.pulse).toBe(1400);
    expect(shellTokens.motion.ring).toBe(1200);
  });

  it('header ölçülerini kaynak dosyadan alır', () => {
    expect(shellTokens.header.titleSize).toBe(config.header.settings.titleSize);
    expect(shellTokens.header.titleLineHeight).toBe(config.header.settings.titleLineHeight);
    expect(shellTokens.header.buttonHeight).toBe(config.header.settings.buttonHeight);
  });

  it('görünüm türlerini ve veri durumlarını kaynak sırasıyla verir', () => {
    expect(shellTokens.header.viewTypes.map((v) => v.value)).toEqual(
      config.header.viewTypes.map((v) => v.value),
    );
    expect(shellTokens.header.dataStates.map((v) => v.value)).toEqual(
      config.header.dataStates.map((v) => v.value),
    );
  });
});

describe('required', () => {
  it('kaynak alanı yoksa hata verir, sabit yedek kullanmaz', () => {
    expect(() => required(undefined, 'dropdown.styles described')).toThrow(
      'Kaynak dosyada değer bulunamadı: dropdown.styles described',
    );
    expect(required(0, 'sıfır')).toBe(0);
  });

  it('rozet ve dropdown ölçüleri kaynaktan gelir', () => {
    const described = config.dropdown.styles.find((x) => x.key === 'described');
    expect(shellTokens.ddRow).toBe(described?.itemHeight);
    expect(shellTokens.ddBox).toBe(described?.contentHeight);
  });
});
