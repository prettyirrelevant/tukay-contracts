// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.2;

/**
 * @dev Define interface for erc20 wrapped
 */
interface IWETH {
    event Deposit(address indexed dst, uint256 wad);

    event Withdrawal(address indexed src, uint256 wad);

    event Transfer(address indexed from, address indexed to, uint256 value);

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    function approve(address spender, uint256 amount) external returns (bool);

    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function deposit() external payable;

    function withdraw(uint256 wad) external;
}
