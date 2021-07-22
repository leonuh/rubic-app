import { Injectable } from '@angular/core';
import { ItProvider } from 'src/app/features/instant-trade/services/instant-trade-service/models/it-provider';
import BigNumber from 'bignumber.js';
import InstantTradeToken from 'src/app/features/instant-trade/models/InstantTradeToken';
import { Observable } from 'rxjs';
import InstantTrade from 'src/app/features/instant-trade/models/InstantTrade';
import { TransactionReceipt } from 'web3-eth';
import { HttpService } from 'src/app/core/services/http/http.service';
import { BLOCKCHAIN_NAME } from 'src/app/shared/models/blockchain/BLOCKCHAIN_NAME';
import { Web3PublicService } from 'src/app/core/services/blockchain/web3-public-service/web3-public.service';
import { ProviderConnectorService } from 'src/app/core/services/blockchain/provider-connector/provider-connector.service';
import {
  ItSettingsForm,
  SettingsService
} from 'src/app/features/swaps/services/settings-service/settings.service';
import { Web3Public } from 'src/app/core/services/blockchain/web3-public-service/Web3Public';
import { TransactionOptions } from 'src/app/shared/models/blockchain/transaction-options';
import { UniSwapTrade } from 'src/app/features/instant-trade/services/instant-trade-service/models/uniswap.types';
import {
  abi,
  ethToTokensEstimatedGas,
  maxTransitTokens,
  routingProviders,
  sushiSwapBscContracts,
  tokensToEthEstimatedGas,
  tokensToTokensEstimatedGas,
  WETH
} from 'src/app/features/instant-trade/services/instant-trade-service/providers/sushi-swap-bsc-service/sushi-swap-bsc.constants';
import { CommonUniswapV2Service } from 'src/app/features/instant-trade/services/instant-trade-service/providers/common-uniswap-v2/common-uniswap-v2.service';

@Injectable({
  providedIn: 'root'
})
export class SushiSwapBscService implements ItProvider {
  protected blockchain: BLOCKCHAIN_NAME;

  protected shouldCalculateGas: boolean;

  private web3Public: Web3Public;

  private WETHAddress: string;

  private sushiswapContractAddress: string;

  private routingProviders: string[];

  private settings: ItSettingsForm;

  constructor(
    private readonly httpService: HttpService,
    private readonly providerConnectorService: ProviderConnectorService,
    private readonly settingsService: SettingsService,
    private readonly commonUniswapV2: CommonUniswapV2Service,
    private readonly w3Public: Web3PublicService
  ) {
    this.web3Public = w3Public[BLOCKCHAIN_NAME.BINANCE_SMART_CHAIN];
    this.blockchain = BLOCKCHAIN_NAME.BINANCE_SMART_CHAIN;
    this.shouldCalculateGas = true;
    this.WETHAddress = WETH.address;
    this.sushiswapContractAddress = sushiSwapBscContracts.address;
    this.routingProviders = routingProviders.addresses;

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
      this.sushiswapContractAddress,
      this.web3Public
    );
  }

  public async approve(tokenAddress: string, options: TransactionOptions): Promise<void> {
    await this.commonUniswapV2.checkSettings(this.blockchain);
    return this.commonUniswapV2.approve(tokenAddress, this.sushiswapContractAddress, options);
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
      fromTokenClone.address = this.WETHAddress;
      estimatedGasPredictionMethod = 'calculateEthToTokensGasLimit';
      estimatedGasArray = ethToTokensEstimatedGas;
    }

    if (this.web3Public.isNativeAddress(toTokenClone.address)) {
      toTokenClone.address = this.WETHAddress;
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
      this.routingProviders,
      this.sushiswapContractAddress,
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
    await this.commonUniswapV2.checkSettings(this.blockchain);
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
        this.sushiswapContractAddress,
        abi
      );
    }

    if (this.web3Public.isNativeAddress(trade.to.token.address)) {
      return this.commonUniswapV2.createTokensToEthTrade(
        uniSwapTrade,
        options,
        this.sushiswapContractAddress,
        abi
      );
    }

    return this.commonUniswapV2.createTokensToTokensTrade(
      uniSwapTrade,
      options,
      this.sushiswapContractAddress,
      abi
    );
  }
}
