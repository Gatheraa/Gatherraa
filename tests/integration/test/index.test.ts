import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("Gatheraa Integration Test Suite", function () {
  it("Should verify test environment is properly configured", async function () {
    const [signer] = await ethers.getSigners();
    expect(signer).to.not.be.undefined;
    expect(signer.address).to.match(/^0x[a-fA-F0-9]{40}$/);
  });

  it("Should verify Hardhat network is available", async function () {
    const blockNumber = await ethers.provider.getBlockNumber();
    expect(blockNumber).to.be.a("number");
    expect(blockNumber).to.be.at.least(0);
  });

  it("Should verify network configuration", async function () {
    const network = await ethers.provider.getNetwork();
    expect(network).to.have.property("chainId");
    expect(network).to.have.property("name");
  });
});
