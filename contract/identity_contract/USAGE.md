# Identity Contract Example Usage

This document shows practical examples of how to use the Identity Registry Contract.

## Setup

```javascript
// Import the contract client
import { IdentityRegistryContractClient } from './identity_contract';

// Initialize contract
const contract = new IdentityRegistryContractClient({
  contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
  networkPassphrase: 'Test SDF Network ; September 2015'
});
```

## 1. Creating a DID

```javascript
// User creates their DID
const publicKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'; // 32-byte public key
const did = await contract.createDID({
  user: userAddress,
  publicKey: publicKey
});

console.log('Created DID:', did);
// Output: did:stellar:abc123def456...
```

## 2. Adding Social Media Claims

```javascript
// Add Twitter claim
const twitterClaimId = await contract.addClaim({
  did: userDID,
  claimType: 'twitter',
  claimValue: '@web3dev',
  proof: twitterProofBytes // Cryptographic proof of Twitter ownership
});

// Add GitHub claim
const githubClaimId = await contract.addClaim({
  did: userDID,
  claimType: 'github',
  claimValue: 'web3developer',
  proof: githubProofBytes
});

// Add Email claim
const emailClaimId = await contract.addClaim({
  did: userDID,
  claimType: 'email',
  claimValue: 'dev@web3.com',
  proof: emailProofBytes
});
```

## 3. Oracle Verification Process

```javascript
// Oracle verifies the claim off-chain
// This would typically happen in a separate oracle service

// Oracle generates signature
const oracleSignature = await oracle.signVerification({
  did: userDID,
  claimId: twitterClaimId,
  verified: true
});

// Submit verification to contract
await contract.verifyClaim({
  did: userDID,
  claimId: twitterClaimId,
  oracleSignature: oracleSignature
});

// Check verification status
const isVerified = await contract.isClaimVerified({
  did: userDID,
  claimId: twitterClaimId
});
console.log('Twitter verified:', isVerified); // true
```

## 4. Building Reputation

```javascript
// Event organizer adds attendance record
await contract.addEventAttendance({
  did: userDID,
  eventId: 'event_2024_web3_conference',
  score: 50
});

// Check updated reputation score
const reputation = await contract.getReputationScore({
  did: userDID
});
console.log('Reputation score:', reputation); // 180 (100 base + 30 verified + 50 attendance)
```

## 5. Delegation Management

```javascript
// Grant team member permission to add claims
const permissions = ['add_claim', 'revoke_claim'];
const expiry = Math.floor(Date.now() / 1000) + 86400; // 24 hours

await contract.addDelegation({
  did: userDID,
  delegate: teamMemberAddress,
  permissions: permissions,
  expiry: expiry
});

// Team member can now add claims on behalf of user
await contract.addClaim({
  did: userDID,
  claimType: 'discord',
  claimValue: 'web3dev#1234',
  proof: discordProofBytes
});

// Revoke delegation when no longer needed
await contract.revokeDelegation({
  did: userDID,
  delegate: teamMemberAddress
});
```

## 6. DID Resolution

```javascript
// Resolve DID to get complete identity document
const didDocument = await contract.resolveDID({
  did: userDID
});

console.log('DID Document:', {
  id: didDocument.id,
  controller: didDocument.controller,
  created: new Date(didDocument.created * 1000),
  reputationScore: didDocument.reputationScore,
  claims: didDocument.claims.map(claim => ({
    type: claim.claimType,
    value: claim.claimValue,
    verified: claim.verified,
    revoked: claim.revoked
  }))
});
```

## 7. Selective Disclosure

```javascript
// Get only verified GitHub claims for selective disclosure
const verifiedGithubClaims = await contract.getVerifiedClaimsByType({
  did: userDID,
  claimType: 'github'
});

// Share only verified GitHub information
const githubInfo = verifiedGithubClaims.map(claim => ({
  username: claim.claimValue,
  verified: claim.verified
}));

console.log('Verified GitHub accounts:', githubInfo);
```

## 8. Security Operations

```javascript
// Revoke compromised credential
await contract.revokeClaim({
  did: userDID,
  claimId: emailClaimId,
  reason: 'Email account compromised'
});

// Check if claim is still valid
const isEmailValid = await contract.isClaimVerified({
  did: userDID,
  claimId: emailClaimId
});
console.log('Email still valid:', isEmailValid); // false

// Deactivate entire DID if needed
await contract.deactivateDID({
  did: userDID
});
```

## 9. Admin Operations

```javascript
// Pause contract during maintenance
await contract.pause();

// Unpause after maintenance
await contract.unpause();

// Check total DIDs in system
const totalDIDs = await contract.getTotalDIDs();
console.log('Total DIDs:', totalDIDs);
```

## 10. Integration with Event Ticketing

```javascript
// Event contract checks attendee reputation
const attendeeDID = await identityContract.getDIDByAddress({
  address: attendeeAddress
});

const reputation = await identityContract.getReputationScore({
  did: attendeeDID
});

// Grant access based on reputation
if (reputation >= 150) {
  // Premium access
  await eventContract.grantPremiumAccess(attendeeAddress);
} else if (reputation >= 100) {
  // Standard access
  await eventContract.grantStandardAccess(attendeeAddress);
} else {
  // Basic access
  await eventContract.grantBasicAccess(attendeeAddress);
}

// Verify specific credentials for special access
const verifiedGithubClaims = await identityContract.getVerifiedClaimsByType({
  did: attendeeDID,
  claimType: 'github'
});

if (verifiedGithubClaims.length > 0) {
  // Grant developer lounge access
  await eventContract.grantDeveloperAccess(attendeeAddress);
}
```

## Error Handling

```javascript
try {
  const did = await contract.createDID({
    user: userAddress,
    publicKey: publicKey
  });
} catch (error) {
  if (error.message.includes('already initialized')) {
    console.log('Contract already initialized');
  } else if (error.message.includes('DID already exists')) {
    console.log('User already has a DID');
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Best Practices

1. **Always verify claims** before making access decisions
2. **Check revocation status** of credentials
3. **Use time-limited delegations** for security
4. **Monitor reputation scores** for trust assessment
5. **Implement proper error handling** in your applications
6. **Use selective disclosure** to protect user privacy
7. **Regularly audit delegations** and revoke unused ones