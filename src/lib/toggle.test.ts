import { toggle } from './toggle';

describe('toggle', () => {
  it('adds a value that is absent, after the ones already there', () => {
    expect(toggle(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes a value that is present', () => {
    expect(toggle(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('leaves the original list alone', () => {
    const original = ['a'];
    toggle(original, 'b');
    expect(original).toEqual(['a']);
  });
});
