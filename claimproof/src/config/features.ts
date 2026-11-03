/**
 * SABOOT Suite — Feature Flags Configuration
 * Allows safe progressive rollout and isolated testing.
 */

export interface FeatureFlags {
  globalEvidenceSearch: boolean;
}

export const FEATURES: FeatureFlags = {
  globalEvidenceSearch: true
};
