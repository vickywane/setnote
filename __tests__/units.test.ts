import { convertWeight } from '../src/lib/units';

describe('convertWeight', () => {
  it('converts units while retaining one decimal place', () => {
    expect(convertWeight(60, 'kg', 'lb')).toBe(132.3);
    expect(convertWeight(135, 'lb', 'kg')).toBe(61.2);
  });
  it('leaves matching units unchanged', () => expect(convertWeight(72.5, 'kg', 'kg')).toBe(72.5));
  it('rejects negative and non-finite values', () => {
    expect(() => convertWeight(-1, 'kg', 'lb')).toThrow(RangeError);
    expect(() => convertWeight(Number.NaN, 'lb', 'kg')).toThrow(RangeError);
  });
});
