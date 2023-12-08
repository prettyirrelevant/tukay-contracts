import { ethers } from 'hardhat';
import 'dotenv/config';

async function main() {
    const giveaway = await ethers.deployContract('Giveaway', [
        process.env.VRF_SUBSCRIPTION_ID,
        '0x354d2f95da55398f44b7cff77da56283d9c6c829a4bdf1bbcaf2ad6a4d081f61', // key hash
        '0x2eD832Ba664535e5886b75D64C46EB9a228C2610', // coordinator address
    ]);
    await giveaway.waitForDeployment();
    console.log(`Giveaway deployed to ${giveaway.target}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
