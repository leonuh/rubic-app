import { LiquidityPool } from 'src/app/features/instant-trade/services/instant-trade-service/providers/uni-swap-v3-service/libs/models/LiquidityPool';

export const routerTokens = {
  WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  WBTC: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  DAI: '0x6b175474e89094c44da98b954eedeac495271d0f'
};

export const routerLiquidityPools: {
  mainnet: LiquidityPool[];
} = {
  mainnet: [
    {
      address: '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8',
      token0: routerTokens.USDC,
      token1: routerTokens.WETH,
      fee: 3000
    },
    {
      address: '0x7858E59e0C01EA06Df3aF3D20aC7B0003275D4Bf',
      token0: routerTokens.USDC,
      token1: routerTokens.USDT,
      fee: 500
    },
    {
      address: '0xCBCdF9626bC03E24f779434178A73a0B4bad62eD',
      token0: routerTokens.WBTC,
      token1: routerTokens.WETH,
      fee: 3000
    },
    {
      address: '0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36',
      token0: routerTokens.WETH,
      token1: routerTokens.USDT,
      fee: 3000
    },
    {
      address: '0x6c6Bc977E13Df9b0de53b251522280BB72383700',
      token0: routerTokens.DAI,
      token1: routerTokens.USDC,
      fee: 500
    },
    {
      address: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
      token0: routerTokens.USDC,
      token1: routerTokens.WETH,
      fee: 500
    }
  ]
};
