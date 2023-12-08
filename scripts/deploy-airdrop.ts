import { ethers } from 'hardhat';

async function main() {
    const percentageCut = 95; // 5% of actual airdrop amount
    const airdrop = await ethers.deployContract('Airdrop', [percentageCut]);
    await airdrop.waitForDeployment();
    console.log(`Airdrop deployed to ${airdrop.target}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
