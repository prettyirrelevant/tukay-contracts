import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { ethers } from 'hardhat';
import { expect } from 'chai';

import IWETH from '../artifacts/contracts/interfaces/IWETH.sol/IWETH.json';

describe('Giveaway', function () {
    const EMPTY_STRING_BYTES32 = ethers.encodeBytes32String('');
    const WAVAX_ADDRESS = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
    const KEY_HASH = '0x354d2f95da55398f44b7cff77da56283d9c6c829a4bdf1bbcaf2ad6a4d081f61';

    async function deployVrfCoordinatorMockFixture() {
        const BASE_FEE = '100000000000000000';
        const GAS_PRICE_LINK = '1000000000'; // 0.000000001 LINK per gas

        const VRFCoordinatorV2MockFactory = await ethers.getContractFactory('VRFCoordinatorV2Mock');
        const VRFCoordinatorV2Mock = await VRFCoordinatorV2MockFactory.deploy(
            BASE_FEE,
            GAS_PRICE_LINK,
        );
        const vrfCoordinatorAddress = await VRFCoordinatorV2Mock.getAddress();

        const fundAmount = '1000000000000000000';
        const transaction = await VRFCoordinatorV2Mock.createSubscription();
        const transactionReceipt = await transaction.wait(1);
        const subscriptionId = ethers.toBigInt(transactionReceipt?.logs[0].topics[1] as string);
        await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, fundAmount);

        return { vrfCoordinatorAddress, VRFCoordinatorV2Mock, subscriptionId };
    }

    async function deployGiveawayFixture() {
        const [owner, otherAccount] = await ethers.getSigners();
        const Giveaway = await ethers.getContractFactory('Giveaway');
        const giveaway = await Giveaway.deploy(
            833,
            KEY_HASH,
            '0x2eD832Ba664535e5886b75D64C46EB9a228C2610',
        );
        const giveawayAddress = await giveaway.getAddress();

        const { VRFCoordinatorV2Mock, subscriptionId } = await loadFixture(
            deployVrfCoordinatorMockFixture,
        );
        await VRFCoordinatorV2Mock.addConsumer(subscriptionId, giveawayAddress);
        return { giveawayAddress, otherAccount, giveaway, owner };
    }

    describe('Deployment', function () {
        it('Should set the right admin', async function () {
            const { giveaway, owner } = await loadFixture(deployGiveawayFixture);
            expect(await giveaway.admin()).to.equal(owner.address);
        });

        it('Should initialize all state variables correctly', async function () {
            const { giveaway } = await loadFixture(deployGiveawayFixture);
            expect(await giveaway.regularGiveawayCounter()).to.equal(0);
        });
    });

    describe('Creations (Regular Giveaway)', function () {
        it('Should create a giveaway with native token', async function () {
            const { giveaway, owner } = await loadFixture(deployGiveawayFixture);
            expect(await giveaway.regularGiveawayCounter()).to.equal(0);

            const prize = ethers.parseEther('0.01');
            const startAt = Math.floor(new Date().getTime() / 1000);
            const endAt = startAt + 86400;
            const giveawayTx = await giveaway.createRegularGiveaway(
                ethers.encodeBytes32String('First of many'),
                endAt,
                ethers.ZeroAddress,
                prize,
                startAt,
                10,
                100,
                { value: prize },
            );

            expect(await giveaway.regularGiveawayCounter()).to.equal(1);
            expect(giveawayTx)
                .to.emit(giveaway, 'NewRegularGiveaway')
                .withArgs(
                    1,
                    ethers.encodeBytes32String('First of many'),
                    ethers.ZeroAddress,
                    prize,
                    endAt,
                    10,
                    100,
                    owner.address,
                );
        });

        it('Should create a giveaway with a valid ERC20 token', async function () {
            const { giveawayAddress, giveaway, owner } = await loadFixture(deployGiveawayFixture);
            const wavaxContract = new ethers.Contract(WAVAX_ADDRESS, IWETH.abi, owner);
            const prize = ethers.parseEther('1');

            await wavaxContract.deposit({ value: ethers.parseEther('50') });
            expect(await wavaxContract.balanceOf(owner.address)).to.equal(ethers.parseEther('50'));

            expect(await giveaway.regularGiveawayCounter()).to.equal(0);
            await wavaxContract.approve(giveawayAddress, prize);

            const startAt = Math.floor(new Date().getTime() / 1000);
            const endAt = startAt + 86400;
            const giveawayTx = await giveaway.createRegularGiveaway(
                ethers.encodeBytes32String('First of many'),
                endAt,
                WAVAX_ADDRESS,
                prize,
                startAt,
                10,
                100,
            );

            expect(await giveaway.regularGiveawayCounter()).to.equal(1);
            expect(giveawayTx)
                .to.emit(giveaway, 'NewRegularGiveaway')
                .withArgs(
                    1,
                    ethers.encodeBytes32String('First of many'),
                    WAVAX_ADDRESS,
                    prize,
                    endAt,
                    10,
                    100,
                    owner.address,
                );
        });

        it('Should fail if requirements are not met', async function () {
            const { giveaway } = await loadFixture(deployGiveawayFixture);
            const prize = ethers.parseEther('0.01');

            expect(await giveaway.regularGiveawayCounter()).to.equal(0);

            const startAt = Math.floor(new Date().getTime() / 1000);
            const endAt = startAt + 86400;

            await expect(
                giveaway.createRegularGiveaway(
                    EMPTY_STRING_BYTES32,
                    endAt,
                    ethers.ZeroAddress,
                    prize,
                    startAt,
                    10,
                    110,
                    { value: prize },
                ),
            ).to.revertedWith('giveaway name cannot be empty');
            await expect(
                giveaway.createRegularGiveaway(
                    ethers.encodeBytes32String('First of many'),
                    endAt,
                    WAVAX_ADDRESS,
                    prize,
                    startAt,
                    10,
                    110,
                ),
            ).to.revertedWith('Insuficient allowance provided');
            await expect(
                giveaway.createRegularGiveaway(
                    ethers.encodeBytes32String('First of many'),
                    endAt,
                    WAVAX_ADDRESS,
                    prize,
                    startAt,
                    0,
                    0,
                ),
            ).to.revertedWith('participants and winners can never be 0');
            await expect(
                giveaway.createRegularGiveaway(
                    ethers.encodeBytes32String('First of many'),
                    endAt,
                    ethers.ZeroAddress,
                    prize,
                    startAt,
                    20,
                    1010,
                    { value: prize },
                ),
            ).to.revertedWith('you cannot have more than 10 winners');
            await expect(
                giveaway.createRegularGiveaway(
                    ethers.encodeBytes32String('First of many'),
                    endAt,
                    ethers.ZeroAddress,
                    prize,
                    startAt,
                    10,
                    5,
                    { value: prize },
                ),
            ).to.revertedWith('participants must always be greater than winners');
            await expect(
                giveaway.createRegularGiveaway(
                    ethers.encodeBytes32String('First of many'),
                    startAt + 1,
                    ethers.ZeroAddress,
                    prize,
                    startAt,
                    5,
                    10000,
                    { value: prize },
                ),
            ).to.revertedWith('giveaway must have a duration of at least 15 minutes');
            await expect(
                giveaway.createRegularGiveaway(
                    ethers.encodeBytes32String('First of many'),
                    endAt,
                    ethers.ZeroAddress,
                    prize,
                    startAt,
                    10,
                    110,
                    { value: ethers.parseEther('0.001') },
                ),
            ).to.revertedWith('Ether sent must be equal to the amount specified');

            expect(await giveaway.regularGiveawayCounter()).to.equal(0);
        });
    });

    describe('Participations (Regular Giveaway)', function () {
        it('Should succeed by default', async function () {
            const { otherAccount, giveaway } = await loadFixture(deployGiveawayFixture);
            const startAt = Math.floor(new Date().getTime() / 1000);
            const prize = ethers.parseEther('0.01');
            const endAt = startAt + 86400;

            await giveaway.createRegularGiveaway(
                ethers.encodeBytes32String('First of many'),
                endAt,
                ethers.ZeroAddress,
                prize,
                startAt,
                10,
                100,
                { value: prize },
            );
            expect(await giveaway.connect(otherAccount).participateInRegularGiveaway(1))
                .to.emit(giveaway, 'NewRegularGiveawayParticipant')
                .withArgs(1, otherAccount.address);
        });

        it('Should fail if participant already exists', async function () {
            const { otherAccount, giveaway } = await loadFixture(deployGiveawayFixture);
            const startAt = Math.floor(new Date().getTime() / 1000);
            const prize = ethers.parseEther('0.01');
            const endAt = startAt + 86400;

            await giveaway.createRegularGiveaway(
                ethers.encodeBytes32String('First of many'),
                endAt,
                ethers.ZeroAddress,
                prize,
                startAt,
                10,
                100,
                { value: prize },
            );

            expect(await giveaway.connect(otherAccount).participateInRegularGiveaway(1))
                .to.emit(giveaway, 'NewRegularGiveawayParticipant')
                .withArgs(1, otherAccount.address);
            await expect(
                giveaway.connect(otherAccount).participateInRegularGiveaway(1),
            ).to.revertedWith('Already a participant for the giveaway');
        });

        it('Should fail if participant already exists', async function () {
            const { otherAccount, giveaway } = await loadFixture(deployGiveawayFixture);
            const startAt = Math.floor(new Date().getTime() / 1000);
            const prize = ethers.parseEther('0.01');
            const endAt = startAt + 86400;

            await giveaway.createRegularGiveaway(
                ethers.encodeBytes32String('First of many'),
                endAt,
                ethers.ZeroAddress,
                prize,
                startAt,
                10,
                100,
                { value: prize },
            );

            expect(await giveaway.connect(otherAccount).participateInRegularGiveaway(1))
                .to.emit(giveaway, 'NewRegularGiveawayParticipant')
                .withArgs(1, otherAccount.address);
            await expect(
                giveaway.connect(otherAccount).participateInRegularGiveaway(1),
            ).to.revertedWith('Already a participant for the giveaway');
        });

        it('Should fail if creator tries to participate', async function () {
            const { giveaway } = await loadFixture(deployGiveawayFixture);
            const startAt = Math.floor(new Date().getTime() / 1000);
            const prize = ethers.parseEther('0.01');
            const endAt = startAt + 86400;

            await giveaway.createRegularGiveaway(
                ethers.encodeBytes32String('First of many'),
                endAt,
                ethers.ZeroAddress,
                prize,
                startAt,
                10,
                100,
                { value: prize },
            );
            await expect(giveaway.participateInRegularGiveaway(1)).to.revertedWith(
                'Giveaway creator cannot participate',
            );
        });

        it('Should fail if giveaway does not exist', async function () {
            const { giveaway } = await loadFixture(deployGiveawayFixture);
            const startAt = Math.floor(new Date().getTime() / 1000);
            const prize = ethers.parseEther('0.01');
            const endAt = startAt + 86400;

            await giveaway.createRegularGiveaway(
                ethers.encodeBytes32String('First of many'),
                endAt,
                ethers.ZeroAddress,
                prize,
                startAt,
                10,
                100,
                { value: prize },
            );
            await expect(giveaway.participateInRegularGiveaway(10)).to.revertedWith(
                'Giveaway does not exist',
            );
        });

        it('Should fail if giveaway max participants reached', async function () {
            const { otherAccount, giveaway } = await loadFixture(deployGiveawayFixture);
            const startAt = Math.floor(new Date().getTime() / 1000);
            const prize = ethers.parseEther('0.01');
            const endAt = startAt + 86400;

            await giveaway.createRegularGiveaway(
                ethers.encodeBytes32String('First of many'),
                endAt,
                ethers.ZeroAddress,
                prize,
                startAt,
                1,
                2,
                { value: prize },
            );
            expect(await giveaway.connect(otherAccount).participateInRegularGiveaway(1))
                .to.emit(giveaway, 'NewRegularGiveawayParticipant')
                .withArgs(1, otherAccount.address);

            // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
            const [_, __, anotherAccount, fourthAccount] = await ethers.getSigners();
            expect(await giveaway.connect(anotherAccount).participateInRegularGiveaway(1))
                .to.emit(giveaway, 'NewRegularGiveawayParticipant')
                .withArgs(1, anotherAccount.address);
            await expect(
                giveaway.connect(fourthAccount).participateInRegularGiveaway(1),
            ).to.revertedWith('Max participants for giveaway reached');
        });
    });

    describe('Withdrawal (Regular Giveaway)', function () {
        // pickWinners & withdraw
    });
});
