/**
 * Feature vector for the Elo model.
 *
 * PLACEHOLDER: the real list (names and order) will be copied from the training
 * notebook. Until then FEATURES_READY is false and predict.ts uses the local
 * estimate only, so we never send invented features to the model.
 */
import type { PredictInput } from './predict';

export const FEATURES_READY = false;

export const FEATURE_NAMES: string[] = [];

export const buildFeatures = (_input: PredictInput): number[] => {
  void _input;
  return [];
};
