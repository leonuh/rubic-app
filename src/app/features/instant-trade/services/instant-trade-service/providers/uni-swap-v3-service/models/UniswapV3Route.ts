import BigNumber from 'bignumber.js';
import { LiquidityPool } from 'src/app/features/instant-trade/services/instant-trade-service/providers/uni-swap-v3-service/controllers/models/LiquidityPool';

export interface UniswapV3Route {
  outputAbsoluteAmount: BigNumber;
  poolsPath: LiquidityPool[];
  initialTokenAddress: string;
}
