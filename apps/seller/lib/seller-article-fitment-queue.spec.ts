import { describe, expect, it } from 'vitest';
import { enqueueExactFitment, MAX_QUEUED_FITMENTS, pendingAfterFailure } from './seller-article-fitment-queue';

const selection = (id: string) => ({ vehicleConfigurationId: id, vehicleLabel: id, position: '', notes: '' });

describe('Seller exact-fitment batch selection', () => {
  it('queues multiple distinct configured vehicles without duplicating a pair', () => {
    const queue = enqueueExactFitment([selection('A')], selection('B'));
    expect(queue.map(item => item.vehicleConfigurationId)).toEqual(['A', 'B']);
    expect(enqueueExactFitment(queue, selection('A'))).toEqual(queue);
  });

  it('ignores empty selections and limits batch size', () => {
    expect(enqueueExactFitment([], selection(''))).toEqual([]);
    const full = Array.from({ length: MAX_QUEUED_FITMENTS }, (_, i) => selection(String(i)));
    expect(enqueueExactFitment(full, selection('extra'))).toEqual(full);
  });

  it('retains unsaved vehicles after a partially successful sequence', () => {
    const queue = [selection('A'), selection('B'), selection('C')];
    expect(pendingAfterFailure(queue, 1).map(item => item.vehicleConfigurationId)).toEqual(['B', 'C']);
    expect(pendingAfterFailure(queue, 3)).toEqual([]);
  });
});
