import { describe, expect, it } from 'vitest';
import { parseCsv, stringifyCsv } from '../common/admin-csv.js';

describe('attribute CSV helpers', () => {
  it('parses quoted commas, escaped quotes and embedded newlines', () => {
    expect(
      parseCsv(
        'code,name,description\r\nATTR_TEST,"Brake, pad","Uses ""quoted"" text\nand a newline"\r\n',
      ),
    ).toEqual([
      ['code', 'name', 'description'],
      ['ATTR_TEST', 'Brake, pad', 'Uses "quoted" text\nand a newline'],
    ]);
  });

  it('accepts an UTF-8 BOM and a final row without a newline', () => {
    expect(parseCsv('\uFEFFcode,name\nATTR_TEST,Test')).toEqual([
      ['code', 'name'],
      ['ATTR_TEST', 'Test'],
    ]);
  });

  it('rejects malformed quoted input', () => {
    expect(() => parseCsv('code,name\nATTR_TEST,"Broken')).toThrow(
      'Unterminated quoted CSV field',
    );
  });

  it('stringifies values using CSV escaping', () => {
    expect(
      stringifyCsv([
        ['code', 'name', 'description'],
        ['ATTR_TEST', 'Brake, pad', 'A "quoted" value'],
      ]),
    ).toBe(
      'code,name,description\r\nATTR_TEST,"Brake, pad","A ""quoted"" value"\r\n',
    );
  });
});
