import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { MerkleTree } from 'merkletreejs';
import { ethers } from 'hardhat';
import { expect } from 'chai';

import IWETH from '../artifacts/contracts/interfaces/IWETH.sol/IWETH.json';

describe('Airdrop', function () {
    const WAVAX_ADDRESS = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';

    async function deployAirdropFixture() {
        const [owner, otherAccount] = await ethers.getSigners();
        const Airdrop = await ethers.getContractFactory('Airdrop');
        const airdrop = await Airdrop.deploy(95);
        const airdropAddress = await airdrop.getAddress();
        return { airdropAddress, otherAccount, airdrop, owner };
    }

    function padBuffer(address: string): Buffer {
        return Buffer.from(address.slice(2).padStart(32 * 2, '0'), 'hex');
    }

    async function generateMerkleProof() {
        const accounts = await ethers.getSigners();
        const whitelisted = accounts.slice(0, 5);
        const notWhitelisted = accounts.slice(5, 10);

        const leaves = whitelisted.map((account) => padBuffer(account.address));
        const tree = new MerkleTree(leaves, ethers.keccak256, { sort: true });
        const merkleRoot = tree.getHexRoot();

        return { notWhitelisted, whitelisted, merkleRoot, leaves, tree };
    }

    describe('Deployment', function () {
        it('Should set the right admin', async function () {
            const { airdrop, owner } = await loadFixture(deployAirdropFixture);
            expect(await airdrop.admin()).to.equal(owner.address);
        });

        it('Should initialize all state variables correctly', async function () {
            const { airdrop } = await loadFixture(deployAirdropFixture);

            expect(await airdrop.count()).to.equal(0);
            expect(await airdrop.percentageCut()).to.equal(95);
        });
    });

    describe('Creations', function () {
        it('Should create an airdrop with native token', async function () {
            const { airdrop, owner } = await loadFixture(deployAirdropFixture);

            const amountToShare = ethers.parseEther('0.01');
            const { whitelisted, merkleRoot } = await generateMerkleProof();

            // airdrop count remains unchanged before creation
            expect(await airdrop.count()).to.equal(0);
            const airdropCreationTx = await airdrop.createAirdrop(
                ethers.encodeBytes32String('First of many'),
                merkleRoot,
                ethers.ZeroAddress,
                amountToShare,
                whitelisted.length,
                { value: amountToShare },
            );

            // airdrop count incremented by one after creation
            expect(await airdrop.count()).to.equal(1);
            expect(airdropCreationTx)
                .to.emit(airdrop, 'NewAirdrop')
                .withArgs(
                    1,
                    ethers.encodeBytes32String('First of many'),
                    ethers.ZeroAddress,
                    amountToShare,
                    merkleRoot,
                    5,
                    owner.address,
                );
        });

        it('Should create an airdrop with a valid ERC20 token', async function () {
            const { airdropAddress, airdrop, owner } = await loadFixture(deployAirdropFixture);
            const wavaxContract = new ethers.Contract(WAVAX_ADDRESS, IWETH.abi, owner);

            await wavaxContract.deposit({ value: ethers.parseEther('50') });
            expect(await wavaxContract.balanceOf(owner.address)).to.equal(ethers.parseEther('50'));

            // airdrop count remains unchanged before creation
            expect(await airdrop.count()).to.equal(0);
            await wavaxContract.approve(airdropAddress, ethers.parseEther('1'));

            const { whitelisted, merkleRoot } = await generateMerkleProof();
            const airdropCreationTx = await airdrop.createAirdrop(
                ethers.encodeBytes32String('First of many'),
                merkleRoot,
                WAVAX_ADDRESS,
                ethers.parseEther('1'),
                whitelisted.length,
            );

            // airdrop count incremented by one after creation
            expect(await airdrop.count()).to.equal(1);
            expect(airdropCreationTx)
                .to.emit(airdrop, 'NewAirdrop')
                .withArgs(
                    1,
                    ethers.encodeBytes32String('First of many'),
                    WAVAX_ADDRESS,
                    ethers.parseEther('1'),
                    merkleRoot,
                    5,
                    owner.address,
                );
        });

        it('Should fail if amount sent mismatch', async function () {
            const { airdrop } = await loadFixture(deployAirdropFixture);

            const amountToShare = ethers.parseEther('0.01');
            const { whitelisted, merkleRoot } = await generateMerkleProof();

            // airdrop count remains unchanged before creation
            expect(await airdrop.count()).to.equal(0);

            await expect(
                airdrop.createAirdrop(
                    ethers.encodeBytes32String('First of many'),
                    merkleRoot,
                    ethers.ZeroAddress,
                    amountToShare,
                    whitelisted.length,
                    { value: ethers.parseEther('0.001') },
                ),
            ).to.revertedWith('Ether sent must be equal to the amount specified');

            // airdrop count remains unchanged after attempting creation
            expect(await airdrop.count()).to.equal(0);
        });

        it('Should fail if ERC20 token balance is < amount', async function () {
            const { airdropAddress, airdrop, owner } = await loadFixture(deployAirdropFixture);
            const wavaxContract = new ethers.Contract(WAVAX_ADDRESS, IWETH.abi, owner);

            await wavaxContract.deposit({ value: ethers.parseEther('0.1') });
            expect(await wavaxContract.balanceOf(owner.address)).to.equal(ethers.parseEther('0.1'));

            // airdrop count remains unchanged before creation
            expect(await airdrop.count()).to.equal(0);
            await wavaxContract.approve(airdropAddress, ethers.parseEther('1'));

            const { whitelisted, merkleRoot } = await generateMerkleProof();

            // airdrop count remains unchanged after attempting creation
            expect(await airdrop.count()).to.equal(0);
            await expect(
                airdrop.createAirdrop(
                    ethers.encodeBytes32String('First of many'),
                    merkleRoot,
                    WAVAX_ADDRESS,
                    ethers.parseEther('1'),
                    whitelisted.length,
                ),
            ).to.revertedWithCustomError(airdrop, 'FailedInnerCall');
        });

        it('Should fail is amount is zero', async function () {
            const { airdrop } = await loadFixture(deployAirdropFixture);

            const amountToShare = ethers.parseEther('0');
            const { whitelisted, merkleRoot } = await generateMerkleProof();

            // airdrop count remains unchanged before creation
            expect(await airdrop.count()).to.equal(0);
            await expect(
                airdrop.createAirdrop(
                    ethers.encodeBytes32String('First of many'),
                    merkleRoot,
                    ethers.ZeroAddress,
                    amountToShare,
                    whitelisted.length,
                    { value: amountToShare },
                ),
            ).to.revertedWith('Airdrop must have an amount to be distributed');
        });
    });

    describe('Participations', function () {
        it('Should fail if airdrop does not exist', async function () {
            const { airdrop } = await loadFixture(deployAirdropFixture);

            const amountToShare = ethers.parseEther('0.1');
            const { notWhitelisted, whitelisted, merkleRoot, tree } = await generateMerkleProof();

            expect(
                await airdrop.createAirdrop(
                    ethers.encodeBytes32String('First of many'),
                    merkleRoot,
                    ethers.ZeroAddress,
                    amountToShare,
                    whitelisted.length,
                    { value: amountToShare },
                ),
            );
            await expect(
                airdrop.withdrawAirdropShare(10, tree.getHexProof(padBuffer(notWhitelisted[0].address))),
            ).to.revertedWith('Airdrop does not exist');
        });

        it('Should fail if address is invalid for the merkle tree', async function () {
            const { airdrop } = await loadFixture(deployAirdropFixture);

            const amountToShare = ethers.parseEther('0.1');
            const { notWhitelisted, whitelisted, merkleRoot, tree } = await generateMerkleProof();

            expect(
                await airdrop.createAirdrop(
                    ethers.encodeBytes32String('First of many'),
                    merkleRoot,
                    ethers.ZeroAddress,
                    amountToShare,
                    whitelisted.length,
                    { value: amountToShare },
                ),
            );
            await expect(
                airdrop.withdrawAirdropShare(1, tree.getHexProof(padBuffer(notWhitelisted[0].address))),
            ).to.revertedWith('You are not a valid recipient of this airdrop');
        });

        it('Should be successful if address is valid for the merkle tree (Native Token)', async function () {
            const { airdropAddress, airdrop, owner } = await loadFixture(deployAirdropFixture);
            const wavaxContract = new ethers.Contract(WAVAX_ADDRESS, IWETH.abi, owner);

            await wavaxContract.deposit({ value: ethers.parseEther('50') });
            expect(await wavaxContract.balanceOf(owner.address)).to.equal(ethers.parseEther('50'));

            await wavaxContract.approve(airdropAddress, ethers.parseEther('1'));

            const { whitelisted, merkleRoot, tree } = await generateMerkleProof();
            await airdrop.createAirdrop(
                ethers.encodeBytes32String('First of many'),
                merkleRoot,
                WAVAX_ADDRESS,
                ethers.parseEther('1'),
                whitelisted.length,
            );

            const airdropParticipationTx = await airdrop
                .connect(whitelisted[2])
                .withdrawAirdropShare(1, tree.getHexProof(padBuffer(whitelisted[2].address)));

            expect(airdropParticipationTx)
                .to.emit(airdrop, 'AirdropDistributed')
                .withArgs(1, whitelisted[2].address, ethers.parseEther('1') / BigInt(whitelisted.length));
        });

        it('Should be successful if address is valid for the merkle tree (ERC20)', async function () {
            const { airdrop } = await loadFixture(deployAirdropFixture);

            const amountToShare = ethers.parseEther('0.1');
            const { whitelisted, merkleRoot, tree } = await generateMerkleProof();

            expect(
                await airdrop.createAirdrop(
                    ethers.encodeBytes32String('First of many'),
                    merkleRoot,
                    ethers.ZeroAddress,
                    amountToShare,
                    whitelisted.length,
                    { value: amountToShare },
                ),
            );

            const airdropParticipationTx = await airdrop
                .connect(whitelisted[2])
                .withdrawAirdropShare(1, tree.getHexProof(padBuffer(whitelisted[2].address)));

            expect(airdropParticipationTx)
                .to.emit(airdrop, 'AirdropDistributed')
                .withArgs(1, whitelisted[2].address, ethers.parseEther('0.1') / BigInt(whitelisted.length));
        });

        it('Should fail if address has already withdrawn airdrop amount', async function () {
            const { airdrop } = await loadFixture(deployAirdropFixture);

            const amountToShare = ethers.parseEther('0.1');
            const { whitelisted, merkleRoot, tree } = await generateMerkleProof();

            expect(
                await airdrop.createAirdrop(
                    ethers.encodeBytes32String('First of many'),
                    merkleRoot,
                    ethers.ZeroAddress,
                    amountToShare,
                    whitelisted.length,
                    { value: amountToShare },
                ),
            );

            const airdropParticipationTx = await airdrop
                .connect(whitelisted[2])
                .withdrawAirdropShare(1, tree.getHexProof(padBuffer(whitelisted[2].address)));

            expect(airdropParticipationTx)
                .to.emit(airdrop, 'AirdropDistributed')
                .withArgs(1, whitelisted[2].address, ethers.parseEther('0.1') / BigInt(whitelisted.length));

            await expect(
                airdrop
                    .connect(whitelisted[2])
                    .withdrawAirdropShare(1, tree.getHexProof(padBuffer(whitelisted[2].address))),
            ).to.revertedWith('This address already claimed the airdrop');
        });
    });
});
