import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';
import '@nomiclabs/hardhat-solhint';

const config: HardhatUserConfig = {
    networks: {
        hardhat: {
            forking: {
                url: 'https://api.avax.network/ext/bc/C/rpc',
            },
        },
    },
    solidity: '0.8.20',
};

export default config;
