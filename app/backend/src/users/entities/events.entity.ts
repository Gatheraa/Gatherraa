import { Directive, Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
@Directive('@key(fields: "id")')
export class Event {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  creatorId: string;
}