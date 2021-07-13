import { Injectable } from '@angular/core';
import { ItProvider } from 'src/app/features/instant-trade/services/instant-trade-service/models/it-provider';
import BigNumber from 'bignumber.js';
import InstantTradeToken from 'src/app/features/instant-trade/models/InstantTradeToken';
import { from, Observable, of } from 'rxjs';
import InstantTrade from 'src/app/features/instant-trade/models/InstantTrade';
import { TransactionReceipt } from 'web3-eth';
import { Web3Public } from 'src/app/core/services/blockchain/web3-public-service/Web3Public';
import { Web3PublicService } from 'src/app/core/services/blockchain/web3-public-service/web3-public.service';
import { BLOCKCHAIN_NAME } from 'src/app/shared/models/blockchain/BLOCKCHAIN_NAME';
import { ProviderConnectorService } from 'src/app/core/services/blockchain/provider-connector/provider-connector.service';
import {
  maxTransitPools,
  uniSwapV3Contracts,
  WETH
} from 'src/app/features/instant-trade/services/instant-trade-service/providers/uni-swap-v3-service/uni-swap-v3-constants';
import { Web3PrivateService } from 'src/app/core/services/blockchain/web3-private-service/web3-private.service';
import InsufficientLiquidityError from 'src/app/core/errors/models/instant-trade/insufficient-liquidity.error';
import { Gas } from 'src/app/features/instant-trade/services/instant-trade-service/models/uniswap-types';
import {
  ItSettingsForm,
  SettingsService
} from 'src/app/features/swaps/services/settings-service/settings.service';
import { CoingeckoApiService } from 'src/app/core/services/external-api/coingecko-api/coingecko-api.service';
import { LiquidtyPoolsController } from 'src/app/features/instant-trade/services/instant-trade-service/providers/uni-swap-v3-service/libs/LiquidtyPoolsController';
import { LiquidityPool } from 'src/app/features/instant-trade/services/instant-trade-service/providers/uni-swap-v3-service/libs/models/LiquidityPool';
import {
  ETHtoWETHEstimatedGas,
  swapEstimatedGas,
  WETHtoETHEstimatedGas
} from 'src/app/features/instant-trade/services/instant-trade-service/providers/uni-swap-v3-service/constants/estimatedGas';

interface UniswapV3Route {
  outputAbsoluteAmount: BigNumber;
  poolsPath: LiquidityPool[];
  initialTokenAddress: string;
}

interface IsEthFromOrTo {
  from: boolean;
  to: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UniSwapV3Service implements ItProvider {
  private web3Public: Web3Public;

  private liquidityPoolsController: LiquidtyPoolsController;

  private WETHAddress: string;

  private settings: ItSettingsForm;

  constructor(
    private readonly web3PublicService: Web3PublicService,
    private readonly providerConnectorService: ProviderConnectorService,
    private readonly web3PrivateService: Web3PrivateService,
    private readonly settingsService: SettingsService,
    private readonly coingeckoApiService: CoingeckoApiService
  ) {
    this.web3Public = this.web3PublicService[BLOCKCHAIN_NAME.ETHEREUM];
    this.liquidityPoolsController = new LiquidtyPoolsController(this.web3Public);

    this.WETHAddress = WETH.address;

    const settingsForm = this.settingsService.settingsForm.controls.INSTANT_TRADE;
    this.setSettings(settingsForm.value);
    settingsForm.valueChanges.subscribe(formValue => {
      this.setSettings(formValue);
    });
  }

  private setSettings(settingsFormValue: ItSettingsForm): void {
    this.settings = {
      ...settingsFormValue,
      slippageTolerance: settingsFormValue.slippageTolerance / 100
    };
  }

  public needApprove(tokenAddress: string): Observable<BigNumber> {
    if (this.web3Public.isNativeAddress(tokenAddress)) {
      return of(new BigNumber(Infinity));
    }
    return from(
      this.web3Public.getAllowance(
        tokenAddress,
        this.providerConnectorService.address,
        uniSwapV3Contracts.swapRouter.address
      )
    );
  }

  public async approve(
    tokenAddress: string,
    options: { onTransactionHash?: (hash: string) => void }
  ): Promise<void> {
    this.providerConnectorService.checkSettings(BLOCKCHAIN_NAME.ETHEREUM);
    await this.web3PrivateService.approveTokens(
      tokenAddress,
      uniSwapV3Contracts.swapRouter.address,
      'infinity',
      options
    );
  }

  public async calculateTrade(
    fromAmount: BigNumber,
    fromToken: InstantTradeToken,
    toToken: InstantTradeToken
  ): Promise<InstantTrade> {
    const fromTokenClone = { ...fromToken };
    const toTokenClone = { ...toToken };
    const isEth: IsEthFromOrTo = {} as IsEthFromOrTo;
    if (this.web3Public.isNativeAddress(fromToken.address)) {
      fromTokenClone.address = this.WETHAddress;
      isEth.from = true;
    }
    if (this.web3Public.isNativeAddress(toToken.address)) {
      toTokenClone.address = this.WETHAddress;
      isEth.to = true;
    }

    if (
      (isEth.from && toToken.address.toLowerCase() === this.WETHAddress.toLowerCase()) ||
      (isEth.to && fromToken.address.toLowerCase() === this.WETHAddress.toLowerCase())
    ) {
      const estimatedGas = isEth.from ? ETHtoWETHEstimatedGas : WETHtoETHEstimatedGas;
      const { gasFeeInUsd, gasFeeInEth } = await this.getGasFees(estimatedGas);
      return {
        from: {
          token: fromToken,
          amount: fromAmount
        },
        to: {
          token: toToken,
          amount: fromAmount
        },
        estimatedGas,
        gasFeeInUsd,
        gasFeeInEth
      };
    }

    const fromAmountAbsolute = fromAmount.multipliedBy(10 ** fromToken.decimals);
    const routeLiquidityPoolsAddresses =
      await this.liquidityPoolsController.getRoutesLiquidityPools(
        fromTokenClone.address,
        toTokenClone.address
      );
    const { route, gasData } = await this.getToAmountAndPath(
      fromAmountAbsolute.toFixed(),
      fromTokenClone,
      toTokenClone,
      isEth,
      routeLiquidityPoolsAddresses,
      this.settings.rubicOptimisation
    );

    return {
      from: {
        token: fromToken,
        amount: fromAmount
      },
      to: {
        token: toToken,
        amount: route.outputAbsoluteAmount.div(10 ** toToken.decimals)
      },
      estimatedGas: gasData.estimatedGas,
      gasFeeInUsd: gasData.gasFeeInUsd,
      gasFeeInEth: gasData.gasFeeInEth,
      options: {
        poolsPaths: route
      }
    };
  }

  private async getGasFees(
    estimatedGas: BigNumber,
    gasPrice?: BigNumber,
    ethPrice?: BigNumber
  ): Promise<{ gasFeeInEth: BigNumber; gasFeeInUsd: BigNumber }> {
    gasPrice = gasPrice || (await this.web3Public.getGasPriceInETH());
    ethPrice = ethPrice || (await this.coingeckoApiService.getEtherPriceInUsd());
    const gasFeeInEth = estimatedGas.multipliedBy(gasPrice);
    const gasFeeInUsd = gasFeeInEth.multipliedBy(ethPrice);
    return {
      gasFeeInEth,
      gasFeeInUsd
    };
  }

  private async getToAmountAndPath(
    fromAmountAbsolute: string,
    fromToken: InstantTradeToken,
    toToken: InstantTradeToken,
    isEth: IsEthFromOrTo,
    routeLiquidityPools: LiquidityPool[],
    shouldOptimiseGas: boolean
  ): Promise<{ route: UniswapV3Route; gasData: Gas }> {
    const routes = (
      await this.getAllRoutes(
        fromAmountAbsolute,
        fromToken,
        toToken,
        routeLiquidityPools,
        this.settings.disableMultihops ? 0 : maxTransitPools
      )
    ).sort((a, b) => b.outputAbsoluteAmount.comparedTo(a.outputAbsoluteAmount));

    if (routes.length === 0) {
      throw new InsufficientLiquidityError();
    }

    const walletAddress = this.providerConnectorService.address;
    const deadline = Math.floor(Date.now() / 1000) + 60 * this.settings.deadline;
    const gasPrice = await this.web3Public.getGasPriceInETH();
    const ethPrice = await this.coingeckoApiService.getEtherPriceInUsd();

    if (shouldOptimiseGas && toToken.price) {
      const promises: Promise<{
        route: UniswapV3Route;
        gasData: Gas;
        profit: BigNumber;
      }>[] = routes.map(async route => {
        const estimatedGas = await this.getEstimatedGas(
          fromAmountAbsolute,
          toToken,
          isEth,
          route,
          walletAddress,
          deadline
        );
        const { gasFeeInEth, gasFeeInUsd } = await this.getGasFees(
          estimatedGas,
          gasPrice,
          ethPrice
        );
        const profit = route.outputAbsoluteAmount
          .div(10 ** toToken.decimals)
          .multipliedBy(toToken.price)
          .minus(gasFeeInUsd);

        return {
          route,
          gasData: {
            estimatedGas,
            gasFeeInUsd,
            gasFeeInEth
          },
          profit
        };
      });

      const results = await Promise.all(promises);
      return results.sort((a, b) => b.profit.comparedTo(a.profit))[0];
    }

    const route = routes[0];
    const estimatedGas = await this.getEstimatedGas(
      fromAmountAbsolute,
      toToken,
      isEth,
      route,
      walletAddress,
      deadline
    );
    const { gasFeeInEth, gasFeeInUsd } = await this.getGasFees(estimatedGas, gasPrice, ethPrice);

    return {
      route,
      gasData: {
        estimatedGas,
        gasFeeInEth,
        gasFeeInUsd
      }
    };
  }

  private async getAllRoutes(
    fromAmountAbsolute: string,
    fromToken: InstantTradeToken,
    toToken: InstantTradeToken,
    routeLiquidityPools: LiquidityPool[],
    routeMaxTransitPools: number
  ): Promise<UniswapV3Route[]> {
    const routePromises: Promise<UniswapV3Route>[] = [];

    const addPath = (poolsPath: LiquidityPool[]) => {
      routePromises.push(
        new Promise<UniswapV3Route>((resolve, reject) => {
          let methodName: string;
          let methodArguments: unknown[];
          if (poolsPath.length === 1) {
            methodName = 'quoteExactInputSingle';
            methodArguments = [
              fromToken.address,
              toToken.address,
              poolsPath[0].fee,
              fromAmountAbsolute,
              0
            ];
          } else {
            methodName = 'quoteExactInput';
            methodArguments = [
              this.liquidityPoolsController.getContractPoolsPath(poolsPath, fromToken.address),
              fromAmountAbsolute
            ];
          }

          this.web3Public
            .callContractMethod(
              uniSwapV3Contracts.quoter.address,
              uniSwapV3Contracts.quoter.abi,
              methodName,
              {
                methodArguments
              }
            )
            .then((response: string) => {
              resolve({
                outputAbsoluteAmount: new BigNumber(response),
                poolsPath,
                initialTokenAddress: fromToken.address
              });
            })
            .catch(err => {
              console.debug(err);
              reject();
            });
        })
      );
    };

    const recGraphVisitor = (
      path: LiquidityPool[],
      lastTokenAddress: string,
      mxTransitPools
    ): void => {
      if (path.length === mxTransitPools) {
        const pools = routeLiquidityPools.filter(pool =>
          LiquidtyPoolsController.isPoolWithTokens(pool, lastTokenAddress, toToken.address)
        );
        pools.forEach(pool => addPath(path.concat(pool)));
        return;
      }
      routeLiquidityPools
        .filter(pool => !path.includes(pool))
        .forEach(pool => {
          if (pool.token0.toLowerCase() === lastTokenAddress.toLowerCase()) {
            const extendedPath = path.concat(pool);
            recGraphVisitor(extendedPath, pool.token1, mxTransitPools);
          }
          if (pool.token1.toLowerCase() === lastTokenAddress.toLowerCase()) {
            const extendedPath = path.concat(pool);
            recGraphVisitor(extendedPath, pool.token0, mxTransitPools);
          }
        });
    };

    for (let i = 0; i <= routeMaxTransitPools; i++) {
      recGraphVisitor([], fromToken.address, i);
    }

    return (await Promise.allSettled(routePromises))
      .filter(res => res.status === 'fulfilled')
      .map((res: PromiseFulfilledResult<UniswapV3Route>) => res.value);
  }

  private async getEstimatedGas(
    fromAmountAbsolute: string,
    toToken: InstantTradeToken,
    isEth: IsEthFromOrTo,
    route: UniswapV3Route,
    walletAddress: string,
    deadline: number
  ): Promise<BigNumber> {
    const allowance = isEth.from
      ? new BigNumber(Infinity)
      : await this.web3Public.getAllowance(
          route.initialTokenAddress,
          walletAddress,
          uniSwapV3Contracts.swapRouter.address
        );
    const balance = isEth.from
      ? await this.web3Public.getBalance(walletAddress, { inWei: true })
      : await this.web3Public.getTokenBalance(walletAddress, route.initialTokenAddress);
    if (!walletAddress || !allowance.gte(fromAmountAbsolute) || !balance.gte(fromAmountAbsolute)) {
      return swapEstimatedGas[route.poolsPath.length - 1].plus(
        isEth.to ? WETHtoETHEstimatedGas : 0
      );
    }

    const amountOutMin = route.outputAbsoluteAmount
      .multipliedBy(new BigNumber(1).minus(this.settings.slippageTolerance))
      .toFixed(0);

    let methodName: string;
    let methodArguments: unknown[];
    if (route.poolsPath.length === 1) {
      methodName = 'exactInputSingle';
      methodArguments = [
        [
          route.initialTokenAddress,
          toToken.address,
          route.poolsPath[0].fee,
          walletAddress,
          deadline,
          fromAmountAbsolute,
          amountOutMin,
          0
        ]
      ];
    } else {
      methodName = 'exactInput';
      methodArguments = [
        this.liquidityPoolsController.getContractPoolsPath(
          route.poolsPath,
          route.initialTokenAddress
        ),
        walletAddress,
        deadline,
        fromAmountAbsolute,
        amountOutMin
      ];
    }

    return this.web3Public.getEstimatedGas(
      uniSwapV3Contracts.swapRouter.abi,
      uniSwapV3Contracts.swapRouter.address,
      methodName,
      methodArguments,
      walletAddress,
      isEth.from ? fromAmountAbsolute : null
    );
  }

  public createTrade(
    trade: InstantTrade,
    options: { onConfirm?: (hash: string) => void; onApprove?: (hash: string | null) => void }
  ): Promise<TransactionReceipt> {
    return Promise.resolve(undefined);
  }
}
