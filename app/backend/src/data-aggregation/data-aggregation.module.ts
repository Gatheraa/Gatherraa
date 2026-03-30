import { Module } from '@nestjs/common';
import { DataAggregationController } from './data-aggregation.controller';
import { DataAggregationService } from './data-aggregation.service';

@Module({
  controllers: [DataAggregationController],
  providers: [DataAggregationService],
  exports: [DataAggregationService],
})
export class DataAggregationModule {}
