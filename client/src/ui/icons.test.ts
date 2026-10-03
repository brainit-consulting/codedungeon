import { describe, expect, it } from 'vitest';
import { EMOJI, ICONS, iconSvg, splitIcons } from './icons';

describe('the woodcut icons', () => {
  it('turns the emoji it has icons for into icon runs, keeping the text around them', () => {
    expect(splitIcons('⚠️ needs you')).toEqual([{ icon: 'warning' }, { text: ' needs you' }]);
    expect(splitIcons('⚙️ 3 busy · 🔍 1 in QA')).toEqual([{ icon: 'gear' }, { text: ' 3 busy · ' }, { icon: 'lens' }, { text: ' 1 in QA' }]);
    expect(splitIcons('🏰')).toEqual([{ icon: 'castle' }]);
  });

  it("leaves text without emoji, and emoji it has no icon for, exactly as they were", () => {
    expect(splitIcons('plain words')).toEqual([{ text: 'plain words' }]);
    expect(splitIcons('a 🦄 here')).toEqual([{ text: 'a 🦄 here' }]);
    expect(splitIcons('')).toEqual([]);
    expect(splitIcons('👩‍💻 joined')).toEqual([{ text: '👩‍💻 joined' }]); // a joined emoji stays whole
  });

  it('has a drawing for every emoji it maps', () => {
    for (const [emoji, name] of Object.entries(EMOJI)) expect(ICONS, `${emoji} → ${name}`).toHaveProperty(name);
  });

  it('draws a complete SVG in the colours asked for', () => {
    const svg = iconSvg('candle', { ink: '#111111', paper: '#eeeeee', rust: '#aa4411' });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"')).toBe(true);
    expect(svg).toContain('#aa4411');
    expect(svg).not.toMatch(/\{(ink|paper|rust)\}/);
  });
});
