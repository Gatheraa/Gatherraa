import type { Meta, StoryObj } from '@storybook/react';
import { FAQAccordion } from './FAQAccordion';

const meta: Meta<typeof FAQAccordion> = {
  title: 'Common/FAQAccordion',
  component: FAQAccordion,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A reusable FAQ accordion component with keyboard accessibility, smooth animations, and support for multiple open items.',
      },
    },
  },
  argTypes: {
    items: {
      description: 'Array of FAQ items with id, question, and answer',
      control: 'object',
    },
    allowMultipleOpen: {
      description: 'Allow multiple accordion items to be open simultaneously',
      control: 'boolean',
    },
    defaultOpenIds: {
      description: 'IDs of items that should be open by default',
      control: 'object',
    },
    onItemToggle: {
      description: 'Callback fired when an item is toggled',
      control: false,
    },
    className: {
      description: 'Additional CSS class names',
      control: 'text',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const sampleFAQs = [
  {
    id: 'faq-1',
    question: 'What is Gatheraa?',
    answer:
      'Gatheraa is a decentralized event management platform that leverages blockchain technology to create transparent, secure, and efficient event experiences. Our platform enables event creators to manage tickets, attendees, and funds with complete transparency.',
  },
  {
    id: 'faq-2',
    question: 'How do I create an event?',
    answer:
      'Creating an event on Gatheraa is simple. First, connect your wallet, then navigate to "Create Event" and fill in the event details including name, description, date, location, and ticket information. Once submitted, your event will be live on the platform.',
  },
  {
    id: 'faq-3',
    question: 'What blockchain networks does Gatheraa support?',
    answer:
      'Gatheraa currently supports Ethereum mainnet, Polygon, Arbitrum, and Optimism. We are continuously working on adding support for additional networks based on community feedback and demand.',
  },
  {
    id: 'faq-4',
    question: 'How are transaction fees calculated?',
    answer:
      'Transaction fees on Gatheraa include smart contract execution fees, which vary based on network congestion. Our platform aims to minimize fees while ensuring security. You can always see the estimated gas fees before confirming any transaction.',
  },
  {
    id: 'faq-5',
    question: 'Is my data secure?',
    answer:
      'Yes. All event data and transactions are secured by the blockchain. Personal information is encrypted and only accessible to authorized parties. We follow industry-standard security practices and regularly audit our smart contracts.',
  },
];

/**
 * Default FAQ Accordion with single open item
 */
export const Default: Story = {
  args: {
    items: sampleFAQs,
    allowMultipleOpen: false,
  },
};

/**
 * FAQ Accordion with multiple items open at once
 */
export const MultipleOpen: Story = {
  args: {
    items: sampleFAQs,
    allowMultipleOpen: true,
    defaultOpenIds: ['faq-1', 'faq-2'],
  },
};

/**
 * FAQ Accordion with default open items
 */
export const WithdefaultOpen: Story = {
  args: {
    items: sampleFAQs,
    allowMultipleOpen: false,
    defaultOpenIds: ['faq-1'],
  },
};

/**
 * FAQ Accordion with fewer items (Help section)
 */
export const HelpSection: Story = {
  args: {
    items: [
      {
        id: 'help-1',
        question: 'How do I reset my password?',
        answer:
          'Click "Forgot Password" on the login page, enter your email, and follow the instructions sent to your inbox. The reset link will be valid for 24 hours.',
      },
      {
        id: 'help-2',
        question: 'How do I contact support?',
        answer:
          'You can reach our support team via email at support@gatheraa.com or through the help chat widget in the bottom right corner of the application.',
      },
      {
        id: 'help-3',
        question: 'What payment methods are accepted?',
        answer:
          'We accept payments in major cryptocurrencies including ETH, USDC, USDT, and DAI. All transactions are processed through secure smart contracts.',
      },
    ],
    allowMultipleOpen: false,
  },
};

/**
 * FAQ Accordion with callback to track state
 */
export const WithCallback: Story = {
  args: {
    items: sampleFAQs.slice(0, 3),
    allowMultipleOpen: true,
    onItemToggle: (id: string, isOpen: boolean) => {
      console.log(`Item ${id} is now ${isOpen ? 'open' : 'closed'}`);
    },
  },
};

/**
 * Large FAQ list (course guide)
 */
export const CourseGuide: Story = {
  args: {
    items: [
      {
        id: 'course-1',
        question: 'Module 1: Introduction to Blockchain',
        answer:
          'This module covers the fundamental concepts of blockchain technology, including distributed ledgers, consensus mechanisms, and cryptography. Duration: 2 hours',
      },
      {
        id: 'course-2',
        question: 'Module 2: Smart Contracts Basics',
        answer:
          'Learn how to write, deploy, and interact with smart contracts. We cover Solidity, contract deployment, and testing strategies. Prerequisites: Module 1. Duration: 3 hours',
      },
      {
        id: 'course-3',
        question: 'Module 3: Web3 Integration',
        answer:
          'Integrate Web3 functionality into your applications. Learn about wallet connections, contract interactions, and transaction management. Prerequisites: Module 2. Duration: 2.5 hours',
      },
      {
        id: 'course-4',
        question: 'Module 4: Dapp Development',
        answer:
          'Build complete decentralized applications. This module combines all previous concepts into practical project work. Prerequisites: Modules 1-3. Duration: 4 hours',
      },
      {
        id: 'course-5',
        question: 'Module 5: Security Best Practices',
        answer:
          'Understand smart contract security, common vulnerabilities, and best practices. Learn about audits and security testing. Duration: 2 hours',
      },
      {
        id: 'course-6',
        question: 'Module 6: Advanced Patterns',
        answer:
          'Explore advanced design patterns, gas optimization, and scalability solutions. Duration: 3 hours',
      },
    ],
    allowMultipleOpen: true,
  },
};
