// Types for the interface's translations, so the tests can check them.
export function t(key: string, vars?: Record<string, string | number>): string;
export function label(group: string, value: string): string;
export function lang(): 'zh-CN' | 'en';
export function setLang(value: 'zh-CN' | 'en'): void;
export const dictionary: Record<string, [string, string]>;
