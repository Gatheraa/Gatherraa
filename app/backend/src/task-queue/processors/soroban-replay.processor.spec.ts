// SorobanReplayProcessor tests (issue #711)
//
// Proves the worker delegates to the replay service with the job's options and
// reports the processed range.

import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { SorobanReplayProcessor } from './soroban-replay.processor';
import { SorobanReplayService } from '../replay/soroban-replay.service';

describe('SorobanReplayProcessor', () => {
  let processor: SorobanReplayProcessor;
  const runBackfill = jest.fn().mockResolvedValue({
    networkId: 'stellar',
    fromSeq: 1,
    toSeq: 5,
    processedLedgers: 5,
    ingested: 5,
    cursor: 5,
  });

  const createJob = (data: any = {}) =>
    ({
      id: 'replay-job-1',
      data,
      updateProgress: jest.fn().mockResolvedValue(undefined),
    }) as unknown as Job;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SorobanReplayProcessor,
        { provide: SorobanReplayService, useValue: { runBackfill } },
      ],
    }).compile();
    processor = module.get(SorobanReplayProcessor);
  });

  it('runs the backfill with the job options and reports the range', async () => {
    const result = await processor.process(
      createJob({ networkId: 'stellar', fromSeq: 1, toSeq: 5 }),
    );

    expect(runBackfill).toHaveBeenCalledWith({
      networkId: 'stellar',
      fromSeq: 1,
      toSeq: 5,
      batchSize: undefined,
    });
    expect(result).toMatchObject({ success: true, cursor: 5, processedLedgers: 5 });
  });

  it('propagates replay failures', async () => {
    runBackfill.mockRejectedValueOnce(new Error('provider not configured'));

    await expect(
      processor.process(createJob({ networkId: 'stellar', fromSeq: 1, toSeq: 5 })),
    ).rejects.toThrow('provider not configured');
  });
});
