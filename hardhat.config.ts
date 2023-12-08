import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ignition';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-verify';
import '@nomiclabs/hardhat-solhint';
import 'dotenv/config';

const config: HardhatUserConfig = {
    etherscan: {
        customChains: [
            {
                urls: {
                    apiURL: 'https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan',
                    browserURL: 'https://avalanche.routescan.io',
                },
                network: 'snowtrace',
                chainId: 43114,
            },
        ],
        apiKey: {
            avalancheFujiTestnet: 'snowtrace', // apiKey is not required, just set a placeholder
        },
    },
    networks: {
        snowtrace: {
            accounts: [process.env.SNOWTRACE_PRIVATE_KEY as string],
            url: 'https://rpc.ankr.com/avalanche_fuji',
        },
        hardhat: {
            forking: {
                url: 'https://api.avax.network/ext/bc/C/rpc',
            },
        },
    },
    solidity: '0.8.20',
};

export default config;
