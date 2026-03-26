import type { Meta, StoryObj } from "@storybook/react";
import { TransactionStatus } from "./TransactionStatus";

const meta: Meta<typeof TransactionStatus> = {
  title: "Components/TransactionStatus",
  component: TransactionStatus,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    txPromise: {
      description:
        "Promise that resolves to a transaction object with hash and optional wait method",
      control: false,
    },
    explorerUrl: {
      description:
        "Base URL for blockchain explorer (e.g., https://etherscan.io/tx/)",
      control: "text",
    },
    showHash: {
      description: "Whether to display the transaction hash",
      control: "boolean",
    },
    onSuccess: {
      description: "Callback fired when transaction succeeds",
      action: "onSuccess",
    },
    onError: {
      description: "Callback fired when transaction fails",
      action: "onError",
    },
    labels: {
      description: "Custom labels for status states",
      control: "object",
    },
  },
};

export default meta;
type Story = StoryObj<typeof TransactionStatus>;

const createDelayedPromise = (
  result: "success" | "failure",
  delay: number = 2000,
): Promise<{ hash: string; wait?: () => Promise<void> }> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (result === "success") {
        resolve({
          hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          wait: () => new Promise((res) => setTimeout(res, 1000)),
        });
      } else {
        reject(new Error("Transaction failed: Insufficient funds"));
      }
    }, delay);
  });
};

export const Pending: Story = {
  args: {
    txPromise: new Promise(() => {}),
    explorerUrl: "https://etherscan.io/tx/",
    showHash: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Transaction is pending and waiting for confirmation.",
      },
    },
  },
};

export const Success: Story = {
  args: {
    txPromise: Promise.resolve({
      hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      wait: () => Promise.resolve(),
    }),
    explorerUrl: "https://etherscan.io/tx/",
    showHash: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Transaction completed successfully with explorer link.",
      },
    },
  },
};

export const Failed: Story = {
  args: {
    txPromise: Promise.reject(
      new Error("Transaction failed: Insufficient funds"),
    ),
    explorerUrl: "https://etherscan.io/tx/",
    showHash: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Transaction failed with error message displayed.",
      },
    },
  },
};

export const WithoutExplorer: Story = {
  args: {
    txPromise: Promise.resolve({
      hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      wait: () => Promise.resolve(),
    }),
    showHash: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Transaction status without explorer link (hash still visible).",
      },
    },
  },
};

export const WithoutHash: Story = {
  args: {
    txPromise: Promise.resolve({
      hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      wait: () => Promise.resolve(),
    }),
    explorerUrl: "https://etherscan.io/tx/",
    showHash: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Transaction status without showing the hash (compact view).",
      },
    },
  },
};

export const CustomLabels: Story = {
  args: {
    txPromise: Promise.resolve({
      hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      wait: () => Promise.resolve(),
    }),
    explorerUrl: "https://etherscan.io/tx/",
    showHash: true,
    labels: {
      pending: "Processing...",
      success: "Confirmed!",
      failed: "Error",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Custom labels for different transaction states.",
      },
    },
  },
};

export const LivePendingToSuccess: Story = {
  args: {
    txPromise: createDelayedPromise("success", 3000),
    explorerUrl: "https://etherscan.io/tx/",
    showHash: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Live demo: Starts pending, then succeeds after 3 seconds.",
      },
    },
  },
};

export const LivePendingToFailure: Story = {
  args: {
    txPromise: createDelayedPromise("failure", 3000),
    explorerUrl: "https://etherscan.io/tx/",
    showHash: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Live demo: Starts pending, then fails after 3 seconds.",
      },
    },
  },
};
