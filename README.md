# Tukay (Smart Contracts)

This project was intended for the Chainlink Constellation Hackathon(yeah, I cannot complete it lol). More about the hackathon can be found [here](https://constellation-hackathon.devpost.com/).


## Features
- [x] Create airdrop.
- [x] Claim rewards from eligible airdrops.
- [x] Create regular giveaways(other types of giveaway are trivia & activity).
- [x] Participate in regular giveaways.
- [x] Withdraw prize from giveaway pool if selected as winner.
- [x] Create trivia giveaway.
- [x] Participate in trivia giveways.
- [ ] Pick winners for trivia giveaways using Chainlink Functions.
- [x] Withdraw prize from trivia giveaway pool if selected as winner.
- [ ] Create activity giveaway.
- [ ] Participate in activity giveways.
- [ ] Pick winners for activity giveaways using Chainlink Functions.
- [ ] Withdraw prize from activity giveaway pool if selected as winner.
- [ ] Crowdfunding(creation, donation & withdrawal).


## Deployment Addresses
- Airdrop: [0xCa2e26Ba22146780dd5fD9Be66F13C0e8CDb5366](https://testnet.snowtrace.io/address/0xCa2e26Ba22146780dd5fD9Be66F13C0e8CDb5366) (Avalanche Fuji)
- Giveaway: Not deployed.

All deployed contracts have a somewhat robust test suite.


## Giveaway Types
- REGULAR: Chainlink VRF is used to select winners at random. Participants do not have to perform any action.
- TRIVIA: Participants have to engage in answering trivia questions as determined by the creator of the giveaway.
- ACTIVITY: Participants need to perform certain actions(on-chain & off-chain) to be eligible for giveaway e.g. Minimum balance of ERC20 token, Possession of an NFT, Address activity, Present in Discord Channel, Following a twitter/github/instagram account.

## Airdrop
For the airdrop, we generate a merkle tree of the addresses that can claim the reward(native/ERC20 token). The root(stored on-chain) and leaves(stored off-chain) are used to check eligibility.

## Status
Incomplete.
