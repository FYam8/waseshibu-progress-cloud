// Access identifiers are public, versioned deployment configuration, not secrets.
// They must match this deployment's own Access application.
import { SCHOOL_PROFILE } from './deploymentProfile.js';
export const ACCESS_CONFIG = SCHOOL_PROFILE.access;
