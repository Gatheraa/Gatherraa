export class CreateEventDto {
  name: string;
  description?: string;
  contractAddress: string;
  startTime: Date;
  endTime?: Date;
}
