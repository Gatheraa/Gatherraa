import { expect } from "chai";
import { Contract } from "ethers";

/**
 * Common assertion utilities for contract testing
 */

export async function expectTokenBalance(
  token: Contract,
  address: string,
  expectedBalance: string,
  message?: string
): Promise<void> {
  const balance = await token.balanceOf(address);
  expect(balance.toString()).to.equal(
    expectedBalance,
    message || `Expected balance ${expectedBalance} but got ${balance}`
  );
}

export async function expectTokenAllowance(
  token: Contract,
  owner: string,
  spender: string,
  expectedAllowance: string,
  message?: string
): Promise<void> {
  const allowance = await token.allowance(owner, spender);
  expect(allowance.toString()).to.equal(
    expectedAllowance,
    message || `Expected allowance ${expectedAllowance} but got ${allowance}`
  );
}

export async function expectNFTOwnership(
  nft: Contract,
  tokenId: number,
  expectedOwner: string,
  message?: string
): Promise<void> {
  const owner = await nft.ownerOf(tokenId);
  expect(owner).to.equal(
    expectedOwner,
    message || `Expected owner ${expectedOwner} but got ${owner}`
  );
}

export async function expectNFTBalance(
  nft: Contract,
  address: string,
  expectedBalance: number,
  message?: string
): Promise<void> {
  const balance = await nft.balanceOf(address);
  expect(balance).to.equal(
    expectedBalance,
    message || `Expected NFT balance ${expectedBalance} but got ${balance}`
  );
}

export async function expectContractEvent(
  contract: Contract,
  eventName: string,
  filter?: any,
  timeout: number = 5000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Event ${eventName} not emitted within ${timeout}ms`));
    }, timeout);

    contract.once(eventName, (...args) => {
      clearTimeout(timer);
      const event = args[args.length - 1];
      if (filter && !filter(event)) {
        reject(new Error(`Event ${eventName} did not match filter`));
      } else {
        resolve(event);
      }
    });
  });
}

export async function expectRevertWith(
  promise: Promise<any>,
  errorMessage: string
): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected transaction to revert with "${errorMessage}"`);
  } catch (error: any) {
    if (!error.message.includes(errorMessage)) {
      throw new Error(
        `Expected error message "${errorMessage}" but got "${error.message}"`
      );
    }
  }
}

export async function expectRevertWithCustomError(
  promise: Promise<any>,
  errorSignature: string,
  errorArgs?: any[]
): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected transaction to revert with custom error "${errorSignature}"`);
  } catch (error: any) {
    // Check if error data matches custom error signature
    const errorData = error.data || error.error?.data;
    if (!errorData) {
      throw new Error("No error data found in revert");
    }
    
    // Basic check - in real implementation, you'd decode the error data
    if (!error.message.includes(errorSignature)) {
      throw new Error(
        `Expected custom error "${errorSignature}" but got "${error.message}"`
      );
    }
  }
}

export function expectBigNumberEq(
  actual: bigint | string | number,
  expected: bigint | string | number,
  message?: string
): void {
  const actualStr = actual.toString();
  const expectedStr = expected.toString();
  expect(actualStr).to.equal(
    expectedStr,
    message || `Expected ${expectedStr} but got ${actualStr}`
  );
}

export async function expectMultipleNFTBalances(
  nft: Contract,
  addresses: string[],
  expectedBalances: number[]
): Promise<void> {
  expect(addresses.length).to.equal(
    expectedBalances.length,
    "Addresses and balances arrays must have same length"
  );

  for (let i = 0; i < addresses.length; i++) {
    await expectNFTBalance(nft, addresses[i], expectedBalances[i]);
  }
}

export async function expectMultipleTokenBalances(
  token: Contract,
  addresses: string[],
  expectedBalances: string[]
): Promise<void> {
  expect(addresses.length).to.equal(
    expectedBalances.length,
    "Addresses and balances arrays must have same length"
  );

  for (let i = 0; i < addresses.length; i++) {
    await expectTokenBalance(token, addresses[i], expectedBalances[i]);
  }
}

export async function expectStateTransitions(
  contract: Contract,
  stateChecks: Array<{
    method: string;
    args?: any[];
    expected: any;
    message?: string;
  }>
): Promise<void> {
  for (const check of stateChecks) {
    const { method, args = [], expected, message } = check;
    const result = await contract[method](...args);
    
    if (typeof expected === "function") {
      expect(expected(result)).to.be.true;
    } else {
      expect(result.toString()).to.equal(
        expected.toString(),
        message || `${method} returned unexpected value`
      );
    }
  }
}
