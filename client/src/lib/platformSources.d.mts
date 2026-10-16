export type PlatformSource = { name: string; url: string; primary?: boolean; disabled?: boolean; disabledReason?: string };
export type PlatformProduct = {
  id?: string;
  sourceProductId?: string;
  url?: string;
  platformLinks?: Record<string, string>;
};
export function normalizePlatformName(name: string): string;
export function platformIconFor(name: string): string;
export function platformSourcesFor(product: PlatformProduct): PlatformSource[];
export function primarySourceFor(product: PlatformProduct): PlatformSource | undefined;
