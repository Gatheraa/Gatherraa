import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { GraphQLModule } from '@nestjs/graphql';

@Module({
  imports: [GraphQLModule.forRoot([User])],
  controllers: [UsersController],
  providers: [UsersService,],
  exports: [UsersService],
})
export class UsersModule {}