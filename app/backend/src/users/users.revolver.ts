import { Resolver, Query, ResolveReference } from '@nestjs/graphql';
import { User } from './entities/user.entity';

@Resolver(() => User)
export class UsersResolver {

  @Query(() => [User])
  users() {
    return [{ id: '1', email: 'test@mail.com', role: 'USER' }];
  }

  @ResolveReference()
  resolveReference(reference: { __typename: string; id: string }) {
    return { id: reference.id, email: 'federated@mail.com', role: 'USER' };
  }
}