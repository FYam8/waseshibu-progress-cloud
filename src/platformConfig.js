import { SCHOOL_PROFILE } from './deploymentProfile.js';

export const APP_CONFIG = SCHOOL_PROFILE.apps;
export const APP_IDS = Object.freeze(Object.keys(APP_CONFIG));
export const APP_ID_SET = new Set(APP_IDS);
