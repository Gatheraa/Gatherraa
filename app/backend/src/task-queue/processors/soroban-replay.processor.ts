// Soroban replay / backfill job processor (issue #711).
//
// Runs a bounded backfill over a ledger range on the `soroban:replay` queue,
// resuming from the durable cursor when no explicit `fromSeq` is given. A job
// that aborts mid-range resumes from the cursor on the next attempt rather
// than restarting at zero.

import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SorobanReplayOptions, SorobanReplayService } from '../replay/soroban-replay.service';

export interface SorobanReplayJobData extends SorobanReplayOptions {}

@Processor('soroban:replay')
@Injectable()
export class SorobanReplayProcessor extends WorkerHost {
  private readonly logger = new Logger(SorobanReplayProcessor.name);

  constructor(private readonly replayService: SorobanReplayService) {
    super();
  }

  async process(job: Job<SorobanReplayJobData>) {
    const jobId = job.id;
    const { networkId, fromSeq, toSeq, batchSize } = job.data;

    this.logger.log(
      `Processing Soroban replay job ${jobId}: network=${networkId} from=${fromSeq ?? 'cursor'} to=${toSeq ?? 'head'}`,
    );

    await job.updateProgress(10);

    const result = await this.replayService.runBackfill({
      networkId,
      fromSeq,
      toSeq,
      batchSize,
    });

    await job.updateProgress(100);

    this.logger.log(
      `Soroban replay job ${jobId} processed ledgers ${result.fromSeq}..${result.toSeq} (${result.processedLedgers} ledgers)`,
    );

    return { success: true, ...result };
  }
}
