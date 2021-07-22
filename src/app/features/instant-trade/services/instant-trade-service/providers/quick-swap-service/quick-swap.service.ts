import { Injectable } from '@angular/core';
import { ProviderConnectorService } from 'src/app/core/services/blockchain/provider-connector/provider-connector.service';
import { Web3PrivateService } from 'src/app/core/services/blockchain/web3-private-service/web3-private.service';
import { Web3PublicService } from 'src/app/core/services/blockchain/web3-public-service/web3-public.service';
import { BLOCKCHAIN_NAME } from 'src/app/shared/models/blockchain/BLOCKCHAIN_NAME';
import { CoingeckoApiService } from 'src/app/core/services/external-api/coingecko-api/coingecko-api.service';
import { UseTestingModeService } from 'src/app/core/services/use-testing-mode/use-testing-mode.service';
import BigNumber from 'bignumber.js';
import InstantTradeToken from 'src/app/features/instant-trade/models/InstantTradeToken';
import {
  abi,
  ethToTokensEstimatedGas,
  maxTransitTokens,
  routingProviders,
  tokensToEthEstimatedGas,
  tokensToTokensEstimatedGas,
  quickSwapContracts,
  WETH
} from 'src/app/features/instant-trade/services/instant-trade-service/providers/quick-swap-service/quick-swap-constants';
import { TransactionReceipt } from 'web3-eth';
import { UniSwapTrade } from 'src/app/features/instant-trade/services/instant-trade-service/models/uniswap.types';
import { Web3Public } from 'src/app/core/services/blockchain/web3-public-service/Web3Public';
import InstantTrade from 'src/app/features/instant-trade/models/InstantTrade';
import {
  ItSettingsForm,
  SettingsService
} from 'src/app/features/swaps/services/settings-service/settings.service';
import { Observable } from 'rxjs';
import { CommonUniswapV2Service } from 'src/app/features/instant-trade/services/instant-trade-service/providers/common-uniswap-v2/common-uniswap-v2.service';
import { ItProvider } from 'src/app/features/instant-trade/services/instant-trade-service/models/it-provider';

@Injectable({
  providedIn: 'root'
})
export class QuickSwapService implements ItProvider {
  protected blockchain: BLOCKCHAIN_NAME;

  protected shouldCalculateGas: boolean;

  private web3Public: Web3Public;

  private settings: ItSettingsForm;

  constructor(
    private readonly coingeckoApiService: CoingeckoApiService,
    private readonly web3Private: Web3PrivateService,
    private readonly w3Public: Web3PublicService,
    private readonly useTestingModeService: UseTestingModeService,
    private readonly providerConnectorService: ProviderConnectorService,
    private readonly settingsService: SettingsService,
    private readonly commonUniswapV2: CommonUniswapV2Service
  ) {
    useTestingModeService.isTestingMode.subscribe(value => {
      if (value) {
        this.web3Public = w3Public[BLOCKCHAIN_NAME.POLYGON_TESTNET];
      }
    });
    this.web3Public = w3Public[BLOCKCHAIN_NAME.POLYGON];
    this.blockchain = BLOCKCHAIN_NAME.POLYGON;
    this.shouldCalculateGas = true;
    const form = this.settingsService.settingsForm.controls.INSTANT_TRADE;
    this.settings = {
      ...form.value,
      slippageTolerance: form.value.slippageTolerance / 100
    };
    form.valueChanges.subscribe(formValue => {
      this.settings = {
        ...formValue,
        slippageTolerance: formValue.slippageTolerance / 100
      };
    });
  }

  public getAllowance(tokenAddress: string): Observable<BigNumber> {
    return this.commonUniswapV2.getAllowance(
      tokenAddress,
      quickSwapContracts.address,
      this.web3Public
    );
  }

  public async approve(
    tokenAddress: string,
    options: {
      onTransactionHash?: (hash: string) => void;
    }
  ): Promise<void> {
    this.commonUniswapV2.checkSettings(this.blockchain);
    return this.commonUniswapV2.approve(tokenAddress, quickSwapContracts.address, options);
  }

  public async calculateTrade(
    fromAmount: BigNumber,
    fromToken: InstantTradeToken,
    toToken: InstantTradeToken
  ): Promise<InstantTrade> {
    const fromTokenClone = { ...fromToken };
    const toTokenClone = { ...toToken };
    let estimatedGasPredictionMethod = 'calculateTokensToTokensGasLimit';
    let estimatedGasArray = tokensToTokensEstimatedGas;

    if (this.web3Public.isNativeAddress(fromTokenClone.address)) {
      fromTokenClone.address = WETH.address;
      estimatedGasPredictionMethod = 'calculateEthToTokensGasLimit';
      estimatedGasArray = ethToTokensEstimatedGas;
    }

    if (this.web3Public.isNativeAddress(toTokenClone.address)) {
      toTokenClone.address = WETH.address;
      estimatedGasPredictionMethod = 'calculateTokensToEthGasLimit';
      estimatedGasArray = tokensToEthEstimatedGas;
    }

    const amountIn = fromAmount.multipliedBy(10 ** fromTokenClone.decimals).toFixed(0);

    const { route, gasData } = await this.commonUniswapV2.getToAmountAndPath(
      this.settings.rubicOptimisation,
      amountIn,
      fromTokenClone,
      toTokenClone,
      estimatedGasPredictionMethod,
      this.settings,
      this.web3Public,
      routingProviders.addresses,
      quickSwapContracts.address,
      abi,
      maxTransitTokens,
      estimatedGasArray
    );

    return {
      blockchain: this.blockchain,
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
        path: route.path,
        gasOptimization: this.settings.rubicOptimisation
      }
    };
  }

  public async createTrade(
    trade: InstantTrade,
    options: {
      onConfirm?: (hash: string) => void;
      onApprove?: (hash: string) => void;
    } = {}
  ): Promise<TransactionReceipt> {
    this.commonUniswapV2.checkSettings(this.blockchain);
    await this.commonUniswapV2.checkBalance(trade, this.web3Public);

    const amountIn = trade.from.amount.multipliedBy(10 ** trade.from.token.decimals).toFixed(0);

    const amountOutMin = trade.to.amount
      .multipliedBy(new BigNumber(1).minus(this.settings.slippageTolerance))
      .multipliedBy(10 ** trade.to.token.decimals)
      .toFixed(0);
    const { path } = trade.options;
    const to = this.providerConnectorService.address;
    const deadline = Math.floor(Date.now() / 1000) + 60 * this.settings.deadline;

    const uniSwapTrade: UniSwapTrade = { amountIn, amountOutMin, path, to, deadline };

    if (this.web3Public.isNativeAddress(trade.from.token.address)) {
      return this.commonUniswapV2.createEthToTokensTrade(
        uniSwapTrade,
        options,
        quickSwapContracts.address,
        abi
      );
    }

    if (this.web3Public.isNativeAddress(trade.to.token.address)) {
      return this.commonUniswapV2.createTokensToEthTrade(
        uniSwapTrade,
        options,
        quickSwapContracts.address,
        abi
      );
    }

    return this.commonUniswapV2.createTokensToTokensTrade(
      uniSwapTrade,
      options,
      quickSwapContracts.address,
      abi
    );
  }
}
