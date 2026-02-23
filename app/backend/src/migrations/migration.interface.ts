import { QueryRunner } from 'typeorm';

export interface Migration {
  id: string; // semantic id, e.g. 20260223_add_archived_at
  description?: string;
  dependencies?: string[];
  up: (queryRunner: QueryRunner) => Promise<void>;
  down?: (queryRunner: QueryRunner) => Promise<void>;
}
