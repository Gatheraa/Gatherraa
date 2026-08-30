// TaskQueueController tests (issue #711)
//
// Proves the logical replay trigger endpoint exists and enqueues a bounded
// backfill with the operator-supplied range.

import { Test, TestingModule } from '@nestjs/testing';
import { TaskQueueController } from './task-queue.controller';
import { TaskQueueService } from './services/task-queue.service';

describe('TaskQueueController - Soroban replay trigger', () => {
  let controller: TaskQueueController;
  const enqueueSorobanReplay = jest.fn().mockResolvedValue({ id: 'soroban-replay-1' });

  const module = () =>
    Test.createTestingModule({
      controllers: [TaskQueueController],
      providers: [
        {
          provide: TaskQueueService,
          useValue: { enqueueSorobanReplay },
        },
      ],
    }).compile();

  beforeEach(async () => {
    jest.clearAllMocks();
    const ref: TestingModule = await module();
    controller = ref.get(TaskQueueController);
  });

  it('triggers a replay with an explicit bounded range', async () => {
    const res = await controller.triggerSorobanReplay({
      networkId: 'stellar',
      fromSeq: 10,
      toSeq: 20,
    });

    expect(enqueueSorobanReplay).toHaveBeenCalledWith(
      { networkId: 'stellar', fromSeq: 10, toSeq: 20, batchSize: undefined },
      { priority: 0 },
    );
    expect(res).toMatchObject({
      success: true,
      jobId: 'soroban-replay-1',
      queueName: 'soroban:replay',
      fromSeq: 10,
      toSeq: 20,
    });
  });

  it('resumes from the durable cursor when no fromSeq is supplied', async () => {
    const res = await controller.triggerSorobanReplay({ networkId: 'stellar' });

    expect(enqueueSorobanReplay).toHaveBeenCalledWith(
      { networkId: 'stellar', fromSeq: undefined, toSeq: undefined, batchSize: undefined },
      { priority: 0 },
    );
    expect(res.success).toBe(true);
  });
});
