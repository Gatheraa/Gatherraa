// Global test configuration
declare global {
  var expect: typeof import("chai").expect;
}

import { expect } from "chai";

// Extend Chai if needed
import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

// Global test utilities can be added here
export { expect };
