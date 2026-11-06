/** Injection tokens for the values `AppModule.register` provides to every module. */
export const CONFIG = Symbol('StudioConfig');
export const DB = Symbol('Db');
/** The chat model the deep agents use (D24), or null while MiMo isn't set up. */
export const DEEP_MODEL = Symbol('DeepModel');
