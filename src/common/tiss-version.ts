export const TISS_VERSIONS = ['4.01.00', '4.02.00', '4.03.00'] as const;

export type TissVersionCode = (typeof TISS_VERSIONS)[number];

export const DEFAULT_TISS_VERSION: TissVersionCode = '4.03.00';

export function isTissVersion(value: string): value is TissVersionCode {
  return (TISS_VERSIONS as readonly string[]).includes(value);
}
