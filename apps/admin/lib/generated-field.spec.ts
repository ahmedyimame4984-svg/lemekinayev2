import { describe, expect, it } from 'vitest';
import { nextGeneratedFieldValue } from './generated-field';

describe('nextGeneratedFieldValue', () => {
  it('keeps generated identifiers synchronized while the source name changes', () => {
    expect(nextGeneratedFieldValue('BRAKE', 'BRAKE', 'BRAKE_PAD')).toBe(
      'BRAKE_PAD',
    );
  });

  it('starts generation when the field is empty', () => {
    expect(nextGeneratedFieldValue('', '', 'TOYOTA')).toBe('TOYOTA');
  });

  it('preserves an explicit manual override', () => {
    expect(
      nextGeneratedFieldValue('CUSTOM_CODE', 'BRAKE', 'BRAKE_PAD'),
    ).toBe('CUSTOM_CODE');
  });
});
