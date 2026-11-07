/** Injection tokens for the values `AppModule.register` provides to every module. */
export const CONFIG = Symbol('StudioConfig');
export const DB = Symbol('Db');
/** The chat model the deep agents use (D24), or null while MiMo isn't set up. */
export const DEEP_MODEL = Symbol('DeepModel');
/** Asks which place a position is in (D26). The tests hand in a stub; the app uses OpenStreetMap's Nominatim. */
export const GEO_LOOKUP = Symbol('GeoLookup');
/** The boss's backup readers for floor plans (N4) — Doubao (豆包), Agnes AI — OpenAI-style clients, tried in order. */
export const BACKUP_READERS = Symbol('BackupReaders');
