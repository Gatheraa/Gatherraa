import { DataSource } from 'typeorm';
import { Event } from '../events/entities/event.entity';
import { User, UserRole } from '../users/entities/user.entity';

async function seedEvents() {
  const dataSource = new DataSource({
    type: 'sqlite',
    database: process.env.DATABASE_PATH || './database.sqlite',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('Database connected');

    const eventRepository = dataSource.getRepository(Event);
    const userRepository = dataSource.getRepository(User);

    // Create or get organizer users
    const organizers = await Promise.all([
      createOrGetUser(
        userRepository,
        'GBQHXDRVRSJZVIEKVDNUEKXSQN5DN3DO2YP7EGJLU4EIJ5A5BV5RC4TI',
        'eventorganizer1',
        'organizer1@example.com',
        [UserRole.ORGANIZER],
      ),
      createOrGetUser(
        userRepository,
        'GCNY5OXYSY4FKHOPT2SPOQZAUEIG4VK7T3U3QZ3YJ5U6V5YK2RC4TI',
        'eventorganizer2',
        'organizer2@example.com',
        [UserRole.ORGANIZER],
      ),
      createOrGetUser(
        userRepository,
        'GDQERENWDSIU6XU5YVLABM5AMOMUODGNFTFJNWYUI6V4Z7RC4TI',
        'eventorganizer3',
        'organizer3@example.com',
        [UserRole.ORGANIZER, UserRole.ADMIN],
      ),
    ]);

    // Example events data
    const exampleEvents = [
      {
        contractAddress: 'CA7XQ3F2K5V6N8P9Q0R1S2T3U4V5W6X7Y8Z9A0B1C2D3E4F5G6',
        name: 'Stellar Blockchain Summit 2025',
        description:
          'Join us for the premier blockchain conference featuring talks from industry leaders, workshops on Soroban smart contracts, and networking opportunities with Web3 developers.',
        startTime: new Date('2025-06-15T09:00:00Z'),
        endTime: new Date('2025-06-17T18:00:00Z'),
        organizerId: organizers[0].id,
      },
      {
        contractAddress: 'CB8YQ4F3L6W7O9P0Q1R2S3T4U5V6W7X8Y9Z0A1B2C3D4E5F6G7',
        name: 'DeFi Innovation Workshop',
        description:
          'Hands-on workshop covering decentralized finance protocols, liquidity pools, and yield farming strategies on Stellar.',
        startTime: new Date('2025-07-20T10:00:00Z'),
        endTime: new Date('2025-07-20T16:00:00Z'),
        organizerId: organizers[0].id,
      },
      {
        contractAddress: 'CC9ZR5G4M7X8P0Q1R2S3T4U5V6W7X8Y9Z0A1B2C3D4E5F6G7H8',
        name: 'NFT Art Gallery Opening',
        description:
          'Exclusive gallery opening showcasing digital art NFTs minted on Stellar. Meet the artists and explore the future of digital collectibles.',
        startTime: new Date('2025-08-10T18:00:00Z'),
        endTime: new Date('2025-08-10T22:00:00Z'),
        organizerId: organizers[1].id,
      },
      {
        contractAddress: 'CD0AS6H5N8Y9Q1R2S3T4U5V6W7X8Y9Z0A1B2C3D4E5F6G7H8I9',
        name: 'Smart Contract Security Audit Training',
        description:
          'Learn best practices for auditing Soroban smart contracts, identifying vulnerabilities, and implementing secure coding patterns.',
        startTime: new Date('2025-09-05T09:00:00Z'),
        endTime: new Date('2025-09-07T17:00:00Z'),
        organizerId: organizers[1].id,
      },
      {
        contractAddress: 'CE1BT7I6O9Z0R2S3T4U5V6W7X8Y9Z0A1B2C3D4E5F6G7H8I9J0',
        name: 'Stellar Developer Meetup',
        description:
          'Monthly meetup for Stellar developers. Share projects, discuss challenges, and collaborate on open-source initiatives.',
        startTime: new Date('2025-10-15T19:00:00Z'),
        endTime: new Date('2025-10-15T21:00:00Z'),
        organizerId: organizers[2].id,
      },
      {
        contractAddress: 'CF2CU8J7P0A1S3T4U5V6W7X8Y9Z0A1B2C3D4E5F6G7H8I9J0K1',
        name: 'Web3 Gaming Tournament',
        description:
          'Competitive gaming tournament with blockchain-based rewards. Play-to-earn mechanics powered by Stellar smart contracts.',
        startTime: new Date('2025-11-01T12:00:00Z'),
        endTime: new Date('2025-11-03T20:00:00Z'),
        organizerId: organizers[2].id,
      },
      {
        contractAddress: 'CG3DV9K8Q1B2T4U5V6W7X8Y9Z0A1B2C3D4E5F6G7H8I9J0K1L2',
        name: 'Tokenomics & Governance Workshop',
        description:
          'Deep dive into token design, governance models, and DAO structures. Case studies from successful Stellar-based projects.',
        startTime: new Date('2025-12-10T10:00:00Z'),
        endTime: new Date('2025-12-10T17:00:00Z'),
        organizerId: organizers[0].id,
      },
      {
        contractAddress: 'CH4EW0L9R2C3U5V6W7X8Y9Z0A1B2C3D4E5F6G7H8I9J0K1L2M3',
        name: 'Stellar Ecosystem Showcase',
        description:
          'Showcase of innovative projects built on Stellar. Presentations from startups, demos, and networking with investors.',
        startTime: new Date('2026-01-20T09:00:00Z'),
        endTime: new Date('2026-01-22T18:00:00Z'),
        organizerId: organizers[1].id,
      },
    ];

    // Check which events already exist
    const existingContracts = await eventRepository
      .createQueryBuilder('event')
      .select('event.contractAddress')
      .getRawMany();

    const existingAddresses = new Set(existingContracts.map((e) => e.event_contractAddress));

    // Create events that don't exist
    let created = 0;
    let skipped = 0;

    for (const eventData of exampleEvents) {
      if (existingAddresses.has(eventData.contractAddress)) {
        console.log(`Skipping event: ${eventData.name} (already exists)`);
        skipped++;
        continue;
      }

      const event = eventRepository.create(eventData);
      await eventRepository.save(event);
      console.log(`Created event: ${eventData.name} (ID: ${event.id})`);
      created++;
    }

    console.log(`\n✅ Seeding complete!`);
    console.log(`   Created: ${created} events`);
    console.log(`   Skipped: ${skipped} events (already exist)`);
  } catch (error) {
    console.error('Error seeding events:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

async function createOrGetUser(
  userRepository: any,
  walletAddress: string,
  username: string,
  email: string,
  roles: UserRole[],
): Promise<User> {
  let user = await userRepository.findOne({
    where: { walletAddress },
  });

  if (!user) {
    user = userRepository.create({
      walletAddress,
      username,
      email,
      roles,
      isActive: true,
    });
    user = await userRepository.save(user);
    console.log(`Created user: ${username} (${walletAddress})`);
  } else {
    // Update roles if needed
    if (JSON.stringify(user.roles.sort()) !== JSON.stringify(roles.sort())) {
      user.roles = roles;
      await userRepository.save(user);
      console.log(`Updated user roles: ${username}`);
    }
  }

  return user;
}

// Run the seed function
if (require.main === module) {
  seedEvents()
    .then(() => {
      console.log('Seed script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed script failed:', error);
      process.exit(1);
    });
}

export { seedEvents };
