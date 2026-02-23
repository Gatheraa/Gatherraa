import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloGatewayDriver, ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { ApolloGateway } from '@apollo/gateway';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      gateway: {
        supergraphSdl: new ApolloGateway({
          serviceList: [
            { name: 'users', url: 'http://localhost:3001/graphql' },
            { name: 'events', url: 'http://localhost:3002/graphql' },
            { name: 'payments', url: 'http://localhost:3003/graphql' },
          ],
        }),
      },
      playground: true,
    }),
  ],
})
export class GatewayModule {}