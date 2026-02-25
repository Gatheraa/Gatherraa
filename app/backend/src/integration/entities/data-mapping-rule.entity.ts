import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Integration } from './integration.entity';

export enum MappingType {
  FIELD = 'FIELD',
  OBJECT = 'OBJECT',
  ARRAY = 'ARRAY',
  TRANSFORMATION = 'TRANSFORMATION',
}

export enum TransformationType {
  DIRECT = 'DIRECT',
  FUNCTION = 'FUNCTION',
  CONDITIONAL = 'CONDITIONAL',
  LOOKUP = 'LOOKUP',
  FORMAT_DATE = 'FORMAT_DATE',
  FORMAT_NUMBER = 'FORMAT_NUMBER',
  CONCATENATE = 'CONCATENATE',
  SPLIT = 'SPLIT',
}

@Entity('data_mapping_rules')
export class DataMappingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Integration, (integration) => integration.dataMappingRules)
  integration: Integration;

  @Column()
  integrationId: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  sourceField: string;

  @Column()
  targetField: string;

  @Column({
    type: 'enum',
    enum: MappingType,
  })
  mappingType: MappingType;

  @Column({
    type: 'enum',
    enum: TransformationType,
    default: TransformationType.DIRECT,
  })
  transformationType: TransformationType;

  @Column('json', { nullable: true })
  transformationConfig: Record<string, any>;

  @Column('json', { nullable: true })
  defaultValue: any;

  @Column({ default: true })
  isRequired: boolean;

  @Column({ default: false })
  isNullable: boolean;

  @Column({ default: 0 })
  priority: number;

  @Column('json', { nullable: true })
  validationRules: Record<string, any>;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
