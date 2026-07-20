export enum StockUnitDto {
  UNIT = 'UNIT',
  BOX = 'BOX',
}

export enum ValueMode {
  PER_ENTRY_UNIT = 'PER_ENTRY_UNIT',
  PER_BASE_UNIT = 'PER_BASE_UNIT',
}

export function toBaseUnits(
  quantity: number,
  unit: StockUnitDto,
  unitsPerPackage: number,
): number {
  assertValidPackageUnit(unit, unitsPerPackage);

  if (unit === StockUnitDto.BOX) {
    return quantity * unitsPerPackage;
  }

  return quantity;
}

export function toUnitCost(
  value: number,
  valueMode: ValueMode,
  unit: StockUnitDto,
  unitsPerPackage: number,
): number {
  assertValidPackageUnit(unit, unitsPerPackage);

  if (
    valueMode === ValueMode.PER_ENTRY_UNIT &&
    unit === StockUnitDto.BOX
  ) {
    return value / unitsPerPackage;
  }

  return value;
}

export function assertValidPackageUnit(
  unit: StockUnitDto,
  unitsPerPackage: number,
): void {
  if (unit === StockUnitDto.BOX && unitsPerPackage <= 1) {
    throw new Error(
      'BOX unit requires unitsPerPackage greater than 1 on the product',
    );
  }
}
