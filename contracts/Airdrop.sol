// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract Airdrop {
    struct AirdropInfo {
        bytes32 name;
        address token;
        uint256 amount;
        address creator;
        bytes32 merkleRoot;
        uint256 recipientsCount;
    }

    uint256 public count = 0;
    uint256 public percentageCut;
    address internal constant ZERO_ADDRESS = address(0);

    address public admin;
    mapping(uint256 => AirdropInfo) public airdrops;
    mapping(uint256 => mapping(address => bool)) public claimedAirdrops;

    event NewAirdrop(
        uint256 indexed identifier,
        bytes32 name,
        address token,
        bytes32 proof,
        address owner,
        uint256 amount,
        uint256 claims
    );

    event AirdropDistributed(
        uint256 indexed identifier,
        address recipient,
        uint256 amount
    );

    constructor(uint256 _percentageCut) {
        admin = msg.sender;
        percentageCut = _percentageCut;
    }

    function createAirdrop(
        bytes32 name,
        bytes32 root,
        address token,
        uint256 amount,
        uint256 recipientsCount
    ) public payable returns (uint256) {
        require(amount > 0, "Airdrop must have an amount to be distributed");

        if (token == ZERO_ADDRESS) {
            require(
                msg.value == amount,
                "Ether sent must be equal to the amount specified"
            );
        } else {
            IERC20 erc20Token = IERC20(token);
            require(
                erc20Token.allowance(msg.sender, address(this)) >= amount,
                "Insuficient allowance provided"
            );

            SafeERC20.safeTransferFrom(
                erc20Token,
                msg.sender,
                address(this),
                amount
            );
        }

        count += 1;
        uint256 amountAfterFivePercentCut = calculatePercentageCut(amount);
        airdrops[count] = AirdropInfo({
            name: name,
            token: token,
            merkleRoot: root,
            creator: msg.sender,
            recipientsCount: recipientsCount,
            amount: amountAfterFivePercentCut
        });

        emit NewAirdrop(
            count,
            name,
            token,
            root,
            msg.sender,
            amountAfterFivePercentCut,
            recipientsCount
        );
        return count;
    }

    function withdrawAirdropShare(
        uint256 airdropId,
        bytes32[] calldata proof
    ) public payable {
        AirdropInfo memory airdrop = airdrops[airdropId];

        require(airdrop.amount != 0, "Airdrop does not exist");
        require(
            claimedAirdrops[airdropId][msg.sender] == false,
            "This address already claimed the airdrop"
        );
        require(
            MerkleProof.verify(
                proof,
                airdrop.merkleRoot,
                bytes32(uint256(uint160(msg.sender)))
            ),
            "You are not a valid recipient of this airdrop"
        );

        uint256 amountPerRecipient = Math.ceilDiv(
            airdrop.amount,
            airdrop.recipientsCount
        );

        if (airdrop.token == ZERO_ADDRESS) {
            (bool sent, ) = msg.sender.call{value: amountPerRecipient}("");
            require(sent, "Failed to send airdrop amount to recipient");
        } else {
            IERC20 erc20Token = IERC20(airdrop.token);
            SafeERC20.safeTransferFrom(
                erc20Token,
                address(this),
                msg.sender,
                amountPerRecipient
            );
        }

        claimedAirdrops[airdropId][msg.sender] = true;
        emit AirdropDistributed(airdropId, msg.sender, amountPerRecipient);
    }

    function calculatePercentageCut(uint256 value) public view returns (uint256) {
        (bool success, uint256 result) = Math.tryDiv(value, 100);
        require(success, "Division overflowed");

        (success, result) = Math.tryMul(result, percentageCut);
        require(success, "Multiplication underflowed");

        return result;
    }

    function updatePercentageCut(uint256 value) public returns (uint256) {
        percentageCut = value;
        return value;
    }
}
