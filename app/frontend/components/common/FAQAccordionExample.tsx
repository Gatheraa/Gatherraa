'use client';

import React, { useState } from 'react';
import { FAQAccordion } from '@/components/common/FAQAccordion';

// Example FAQ data - can be fetched from an API or stored in a database
const HELP_FAQS = [
  {
    id: 'getting-started',
    question: 'How do I get started with Gatheraa?',
    answer:
      'Getting started is straightforward! First, connect your Web3 wallet (MetaMask, WalletConnect, etc.), then browse available events or create your own. You can purchase tickets with cryptocurrency and manage RSVPs directly on the platform.',
  },
  {
    id: 'wallet-connection',
    question: 'Which wallets are supported?',
    answer:
      'Gatheraa supports all major Web3 wallets including MetaMask, WalletConnect, Coinbase Wallet, and Ledger. We also support hardware wallets for enhanced security. Simply click "Connect Wallet" and select your preferred wallet provider.',
  },
  {
    id: 'ticket-purchase',
    question: 'How do I purchase event tickets?',
    answer:
      'Browse events on our platform, select the event, choose your ticket tier, and proceed to checkout. You can pay in ETH, USDC, USDT, or DAI depending on the event\'s configuration. Tickets are instantly delivered to your wallet as NFTs.',
  },
  {
    id: 'gas-fees',
    question: 'What are gas fees and how are they calculated?',
    answer:
      'Gas fees are blockchain network costs required to process transactions. They vary based on network congestion and are in addition to the ticket price. We always show you the estimated total before checkout includes gas fees. You control how much you\'re willing to pay per transaction.',
  },
  {
    id: 'refund-policy',
    question: 'Can I get a refund for my ticket?',
    answer:
      'Refund policies are set by individual event creators. Check the event details for the specific refund policy. Most events offer refunds up to 48 hours before the event start time. Contact the event organizer directly for refund requests.',
  },
  {
    id: 'nft-tickets',
    question: 'What are NFT tickets and why should I care?',
    answer:
      'NFT tickets are digital ownership certificates on the blockchain. They prove you own the ticket, can be traded with others, and sometimes include exclusive benefits or future perks. NFTs are permanent records of your attendance and can become collectibles over time.',
  },
  {
    id: 'event-creation',
    question: 'How do I create an event on Gatheraa?',
    answer:
      'Click "Create Event", fill in your event details (title, description, date, location, etc.), set ticket tiers and pricing, upload a cover image, and publish. Your event goes live immediately and becomes discoverable to users. You can edit event details and manage RSVPs anytime.',
  },
  {
    id: 'fund-management',
    question: 'How do I manage event funds?',
    answer:
      'All transaction funds are held in smart contracts until you withdraw them. You can withdraw gained funds anytime after the event ends. We provide transparent transaction history and real-time balance tracking in your event dashboard.',
  },
  {
    id: 'security',
    question: 'Is my information and funds secure?',
    answer:
      'Yes! Gatheraa uses audited smart contracts and blockchain technology for maximum security. Your funds are held in non-custodial smart contracts, meaning you maintain full control. We follow industry-standard security practices and never store sensitive information like private keys.',
  },
  {
    id: 'support',
    question: 'Where can I get help if I have issues?',
    answer:
      'You can reach our support team via email at support@gatheraa.com or through the live chat feature in the bottom right corner. We also maintain comprehensive documentation at docs.gatheraa.com and an active community forum on Discord.',
  },
];

const COURSE_MODULES = [
  {
    id: 'module-intro',
    question: 'Module 1: Introduction to Web3 and Blockchain',
    answer: `<p>Learn foundational concepts:</p>
      <ul>
        <li>What is blockchain and how does it work?</li>
        <li>Distributed ledgers and consensus mechanisms</li>
        <li>Crypto wallets and keys</li>
        <li>Introduction to smart contracts</li>
      </ul>
      <p><strong>Duration:</strong> 2 hours</p>
      <p><strong>Prerequisites:</strong> None</p>`,
  },
  {
    id: 'module-smart-contracts',
    question: 'Module 2: Smart Contracts Deep Dive',
    answer: `<p>Master smart contract development:</p>
      <ul>
        <li>Introduction to Solidity</li>
        <li>Writing your first smart contract</li>
        <li>Contract deployment and verification</li>
        <li>Testing and debugging strategies</li>
        <li>Gas optimization basics</li>
      </ul>
      <p><strong>Duration:</strong> 3 hours</p>
      <p><strong>Prerequisites:</strong> Module 1</p>`,
  },
  {
    id: 'module-web3',
    question: 'Module 3: Web3 Integration and Dapp Development',
    answer: `<p>Build decentralized applications:</p>
      <ul>
        <li>Web3.js and ethers.js libraries</li>
        <li>Wallet integration and connection</li>
        <li>Interacting with smart contracts from frontends</li>
        <li>Transaction management and confirmation</li>
        <li>Error handling and user feedback</li>
      </ul>
      <p><strong>Duration:</strong> 2.5 hours</p>
      <p><strong>Prerequisites:</strong> Modules 1-2</p>`,
  },
  {
    id: 'module-security',
    question: 'Module 4: Security Best Practices',
    answer: `<p>Secure your applications and contracts:</p>
      <ul>
        <li>Common smart contract vulnerabilities</li>
        <li>Security audit processes</li>
        <li>Private key management</li>
        <li>Contract verification and transparency</li>
        <li>Secure transaction patterns</li>
      </ul>
      <p><strong>Duration:</strong> 2 hours</p>
      <p><strong>Prerequisites:</strong> Modules 1-3</p>`,
  },
  {
    id: 'module-advanced',
    question: 'Module 5: Advanced Patterns and Optimization',
    answer: `<p>Advanced concepts for production systems:</p>
      <ul>
        <li>Advanced design patterns</li>
        <li>Gas optimization techniques</li>
        <li>Scalability solutions (L2s, sidechains)</li>
        <li>Upgradeable contracts</li>
        <li>Multi-chain deployments</li>
      </ul>
      <p><strong>Duration:</strong> 3 hours</p>
      <p><strong>Prerequisites:</strong> All previous modules</p>`,
  },
];

export default function FAQAccordionExample() {
  const [activeTab, setActiveTab] = useState<'help' | 'course'>('help');
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const handleItemToggle = (id: string, isOpen: boolean) => {
    console.log(`Item ${id} is now ${isOpen ? 'open' : 'closed'}`);
    // You can use this callback to:
    // - Track analytics
    // - Update parent state
    // - Trigger side effects
  };

  return (
    <div className="faq-example-container">
      <div className="faq-example-header">
        <h1>Help & Support Center</h1>
        <p>Find answers to common questions about using Gatheraa and learning Web3 concepts</p>
      </div>

      <div className="faq-example-tabs">
        <button
          className={`tab-button ${activeTab === 'help' ? 'active' : ''}`}
          onClick={() => setActiveTab('help')}
        >
          Help Center
        </button>
        <button
          className={`tab-button ${activeTab === 'course' ? 'active' : ''}`}
          onClick={() => setActiveTab('course')}
        >
          Course Guide
        </button>
      </div>

      <div className="faq-example-content">
        {activeTab === 'help' && (
          <div className="faq-section">
            <h2>Frequently Asked Questions</h2>
            <FAQAccordion
              items={HELP_FAQS}
              allowMultipleOpen={false}
              onItemToggle={handleItemToggle}
            />
          </div>
        )}

        {activeTab === 'course' && (
          <div className="faq-section">
            <h2>Web3 Masterclass Modules</h2>
            <p className="course-description">
              Expand each module to learn about the topics covered in each section. You can keep
              multiple modules open to compare content.
            </p>
            <FAQAccordion
              items={COURSE_MODULES}
              allowMultipleOpen={true}
              defaultOpenIds={['module-intro']}
              onItemToggle={handleItemToggle}
            />
          </div>
        )}
      </div>

      <div className="faq-example-footer">
        <div className="contact-section">
          <h3>Still need help?</h3>
          <p>
            Can't find what you're looking for? Contact our support team at{' '}
            <a href="mailto:support@gatheraa.com">support@gatheraa.com</a> or join our{' '}
            <a href="https://discord.gg/gatheraa">Discord community</a>.
          </p>
        </div>
      </div>

      <style jsx>{`
        .faq-example-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #0e0e0e 0%, #1a1a1a 100%);
          color: #f0ede8;
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .faq-example-header {
          padding: 4rem 2rem;
          text-align: center;
          max-width: 1000px;
          margin: 0 auto;
        }

        .faq-example-header h1 {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 1rem;
          background: linear-gradient(135deg, #c8f04e 0%, #a8d03e 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .faq-example-header p {
          font-size: 1.1rem;
          color: #888;
          line-height: 1.6;
        }

        .faq-example-tabs {
          display: flex;
          gap: 1rem;
          justify-content: center;
          padding: 0 2rem 2rem;
          max-width: 1000px;
          margin: 0 auto;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .tab-button {
          padding: 0.75rem 1.5rem;
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 500;
          transition: all 0.2s ease;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }

        .tab-button:hover {
          color: #c8f04e;
        }

        .tab-button.active {
          color: #c8f04e;
          border-bottom-color: #c8f04e;
        }

        .faq-example-content {
          max-width: 1000px;
          margin: 0 auto;
          padding: 2rem;
        }

        .faq-section h2 {
          font-size: 1.75rem;
          color: #c8f04e;
          margin-bottom: 0.5rem;
        }

        .course-description {
          color: #888;
          margin-bottom: 2rem;
          font-size: 0.95rem;
        }

        .faq-example-footer {
          max-width: 1000px;
          margin: 4rem auto 0;
          padding: 2rem;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .contact-section h3 {
          font-size: 1.25rem;
          color: #c8f04e;
          margin-bottom: 0.75rem;
        }

        .contact-section p {
          color: #888;
          line-height: 1.6;
        }

        .contact-section a {
          color: #c8f04e;
          text-decoration: none;
          transition: opacity 0.2s ease;
        }

        .contact-section a:hover {
          opacity: 0.8;
          text-decoration: underline;
        }

        @media (max-width: 768px) {
          .faq-example-header {
            padding: 2rem 1rem;
          }

          .faq-example-header h1 {
            font-size: 1.75rem;
          }

          .faq-example-header p {
            font-size: 1rem;
          }

          .faq-example-tabs {
            flex-wrap: wrap;
            padding: 0 1rem 1rem;
          }

          .faq-example-content {
            padding: 1rem;
          }

          .faq-example-footer {
            padding: 1rem;
            margin-top: 2rem;
          }
        }
      `}</style>
    </div>
  );
}
