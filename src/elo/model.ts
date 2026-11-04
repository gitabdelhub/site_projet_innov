/**
 * Our Elo model running in the browser.
 *
 * PLACEHOLDER until the .pkl and the notebook are integrated: returns null,
 * which makes predict.ts fall back to the API, then to the local estimate.
 */
export interface BrowserModel {
  predict: (features: number[]) => Promise<number>;
  margin: number;
}

export const browserModel = async (): Promise<BrowserModel | null> => null;
