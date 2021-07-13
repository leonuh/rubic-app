import { Web3Public } from 'src/app/core/services/blockchain/web3-public-service/Web3Public';
import { factoryContractData } from 'src/app/features/instant-trade/services/instant-trade-service/providers/uni-swap-v3-service/libs/constants/factoryContractData';
import {
  routerLiquidityPools,
  routerTokens
} from 'src/app/features/instant-trade/services/instant-trade-service/providers/uni-swap-v3-service/libs/constants/routerLiqudityPools';
import {
  FeeAmount,
  LiquidityPool
} from 'src/app/features/instant-trade/services/instant-trade-service/providers/uni-swap-v3-service/libs/models/LiquidityPool';
import { poolContractAbi } from 'src/app/features/instant-trade/services/instant-trade-service/providers/uni-swap-v3-service/libs/constants/poolContractAbi';

interface Immutables {
  token0: string;
  token1: string;
  fee: number;
}

const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';

export class LiquidtyPoolsController {
  private liquidityPools: LiquidityPool[];

  public static isPoolWithTokens(pool: LiquidityPool, tokenA: string, tokenB: string): boolean {
    return (
      (pool.token0.toLowerCase() === tokenA.toLowerCase() &&
        pool.token1.toLowerCase() === tokenB.toLowerCase()) ||
      (pool.token1.toLowerCase() === tokenA.toLowerCase() &&
        pool.token0.toLowerCase() === tokenB.toLowerCase())
    );
  }

  constructor(private readonly web3Public: Web3Public) {
    this.liquidityPools = routerLiquidityPools.mainnet;
  }

  private async getPoolImmutables(poolContract): Promise<Immutables> {
    return Promise.all([
      poolContract.methods.token0().call(),
      poolContract.methods.token1().call(),
      poolContract.methods.fee().call()
    ]).then(([token0, token1, fee]) => ({
      token0,
      token1,
      fee: parseInt(fee)
    }));
  }

  private async getPoolByAddress(poolAddress: string): Promise<LiquidityPool> {
    const foundPool = this.liquidityPools.find(pool => pool.address === poolAddress);
    if (foundPool) {
      return foundPool;
    }

    try {
      const poolContract = this.web3Public.getContract(poolAddress, poolContractAbi);
      const immutables = await this.getPoolImmutables(poolContract);
      return {
        address: poolAddress,
        token0: immutables.token0,
        token1: immutables.token1,
        fee: immutables.fee as FeeAmount
      };
    } catch (err) {
      console.debug(`Pool Address: ${poolAddress}`, err);
      return null;
    }
  }

  public async getRoutesLiquidityPools(
    fromTokenAddress: string,
    toTokenAddress: string
  ): Promise<LiquidityPool[]> {
    const factoryContract = this.web3Public.getContract(
      factoryContractData.address,
      factoryContractData.abi
    );
    const feeAmounts: FeeAmount[] = [500, 3000, 10000];

    const promises = [];
    Object.values(routerTokens).forEach(routeTokenAddress => {
      feeAmounts.forEach(fee => {
        promises.push(
          factoryContract.methods.getPool(fromTokenAddress, routeTokenAddress, fee).call()
        );
        promises.push(
          factoryContract.methods.getPool(toTokenAddress, routeTokenAddress, fee).call()
        );
      });
    });
    feeAmounts.forEach(fee => {
      promises.push(factoryContract.methods.getPool(fromTokenAddress, toTokenAddress, fee).call());
    });

    const poolAddresses = await Promise.all(promises);
    return (
      await Promise.all(
        [...new Set(poolAddresses)]
          .filter(poolAddress => poolAddress !== EMPTY_ADDRESS)
          .map(poolAddress => this.getPoolByAddress(poolAddress))
      )
    ).filter(pool => !!pool);
  }

  public getContractPoolsPath(pools: LiquidityPool[], initialTokenAddress: string): string {
    let contractPath = initialTokenAddress.slice(2).toLowerCase();
    let lastTokenAddress = initialTokenAddress;
    pools.forEach(pool => {
      contractPath += pool.fee.toString(16).padStart(6, '0');
      const newTokenAddress =
        pool.token0.toLowerCase() === lastTokenAddress.toLowerCase() ? pool.token1 : pool.token0;
      contractPath += newTokenAddress.slice(2).toLowerCase();
      lastTokenAddress = newTokenAddress;
    });
    return `0x${contractPath}`;
  }
}
