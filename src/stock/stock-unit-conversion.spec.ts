import {
  assertValidPackageUnit,
  StockUnitDto,
  toBaseUnits,
  toUnitCost,
  ValueMode,
} from './stock-unit-conversion';

describe('stock-unit-conversion', () => {
  describe('toBaseUnits', () => {
    it('returns quantity unchanged for UNIT', () => {
      expect(toBaseUnits(5, StockUnitDto.UNIT, 12)).toBe(5);
    });

    it('converts BOX to base units', () => {
      expect(toBaseUnits(2, StockUnitDto.BOX, 12)).toBe(24);
    });

    it('rejects BOX when unitsPerPackage is 1', () => {
      expect(() => toBaseUnits(1, StockUnitDto.BOX, 1)).toThrow(
        'BOX unit requires unitsPerPackage greater than 1 on the product',
      );
    });
  });

  describe('toUnitCost', () => {
    it('divides box entry price by unitsPerPackage', () => {
      expect(
        toUnitCost(120, ValueMode.PER_ENTRY_UNIT, StockUnitDto.BOX, 12),
      ).toBe(10);
    });

    it('keeps unit entry price as unit cost', () => {
      expect(
        toUnitCost(10, ValueMode.PER_ENTRY_UNIT, StockUnitDto.UNIT, 12),
      ).toBe(10);
    });

    it('keeps PER_BASE_UNIT value even when unit is BOX', () => {
      expect(
        toUnitCost(10, ValueMode.PER_BASE_UNIT, StockUnitDto.BOX, 12),
      ).toBe(10);
    });
  });

  describe('assertValidPackageUnit', () => {
    it('allows UNIT with any unitsPerPackage', () => {
      expect(() =>
        assertValidPackageUnit(StockUnitDto.UNIT, 1),
      ).not.toThrow();
    });
  });
});
