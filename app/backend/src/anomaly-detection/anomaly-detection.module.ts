/**
 * Anomaly Detection Module
 * Bootstraps all anomaly detection services
 */

import { Module } from '@nestjs/common';
import { OrderbookDataIngestionService } from './ingestion/orderbook-data-ingestion.service';
import { HeuristicDetectionEngine } from './engines/heuristic-detection.engine';
import { MLDetectionEngine } from './engines/ml-detection.engine';
import { AnomalyAlertService } from './alerts/anomaly-alert.service';
import { AnomalyDetectionCoordinatorService } from './coordinator/anomaly-detection-coordinator.service';
import { AnomalyDetectionController } from './anomaly-detection.controller';

@Module({
  controllers: [AnomalyDetectionController],
  providers: [
    OrderbookDataIngestionService,
    HeuristicDetectionEngine,
    MLDetectionEngine,
    AnomalyAlertService,
    AnomalyDetectionCoordinatorService,
  ],
  exports: [AnomalyDetectionCoordinatorService, AnomalyAlertService],
})
export class AnomalyDetectionModule {}
