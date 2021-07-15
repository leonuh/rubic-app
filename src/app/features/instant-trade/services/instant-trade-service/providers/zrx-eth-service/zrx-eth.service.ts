import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { TransactionReceipt } from 'web3-eth';
import { from, Observable } from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ItProvider } from '../../models/it-provider';
import InstantTrade from '../../../../models/InstantTrade';
import InstantTradeToken from '../../../../models/InstantTradeToken';
import { INSTANT_TRADES_PROVIDER } from '../../../../../../shared/models/instant-trade/INSTANT_TRADES_PROVIDER';
import { Web3PublicService } from '../../../../../../core/services/blockchain/web3-public-service/web3-public.service';
import {
  ItSettingsForm,
  SettingsService
} from '../../../../../swaps/services/settings-service/settings.service';
import { Web3Public } from '../../../../../../core/services/blockchain/web3-public-service/Web3Public';
import { CoingeckoApiService } from '../../../../../../core/services/external-api/coingecko-api/coingecko-api.service';
import { BLOCKCHAIN_NAME } from '../../../../../../shared/models/blockchain/BLOCKCHAIN_NAME';
import { ProviderConnectorService } from '../../../../../../core/services/blockchain/provider-connector/provider-connector.service';
import { Web3PrivateService } from '../../../../../../core/services/blockchain/web3-private-service/web3-private.service';
import { CommonUniswapService } from '../common-uniswap/common-uniswap.service';
import { uniSwapContracts, WETH } from '../uni-swap-service/uni-swap-constants';
import { UseTestingModeService } from '../../../../../../core/services/use-testing-mode/use-testing-mode.service';
import { ZRX_API_ADDRESS } from './zrx-eth-constants';

@Injectable({
  providedIn: 'root'
})
export class ZrxEthService implements ItProvider {
  private web3Public: Web3Public;

  private settings: ItSettingsForm;

  private tradeData;

  protected blockchain: BLOCKCHAIN_NAME;

  private apiAddress: string;

  constructor(
    private http: HttpClient,
    private readonly settingsService: SettingsService,
    private readonly w3Public: Web3PublicService,
    private readonly coingeckoApiService: CoingeckoApiService,
    private readonly providerConnector: ProviderConnectorService,
    private readonly web3PrivateService: Web3PrivateService,
    private readonly commonUniswap: CommonUniswapService,
    public providerConnectorService: ProviderConnectorService,
    private readonly useTestingModeService: UseTestingModeService
  ) {
    this.web3Public = this.w3Public[BLOCKCHAIN_NAME.ETHEREUM];
    this.blockchain = BLOCKCHAIN_NAME.ETHEREUM;
    this.apiAddress = ZRX_API_ADDRESS[BLOCKCHAIN_NAME.ETHEREUM];

    useTestingModeService.isTestingMode.subscribe(value => {
      if (value) {
        this.web3Public = w3Public[BLOCKCHAIN_NAME.ETHEREUM_TESTNET];
        this.blockchain = BLOCKCHAIN_NAME.ETHEREUM_TESTNET;
        this.apiAddress = ZRX_API_ADDRESS[BLOCKCHAIN_NAME.ETHEREUM_TESTNET];
      }
    });

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

  public createTrade(
    trade: InstantTrade,
    options: {
      onConfirm?: (hash: string) => void;
      onApprove?: (hash: string) => void;
    } = {}
  ): Promise<TransactionReceipt> {
    const amount = Web3PublicService.weiToAmount(this.tradeData.sellAmount, 18).toString(10);
    return this.web3PrivateService.sendTransaction(this.tradeData.to, amount, {
      data: this.tradeData.data,
      gas: this.tradeData.gas,
      gasPrice: this.tradeData.gasPrice,
      value: this.tradeData.value
    });
  }

  public async calculateTrade(
    fromAmount: BigNumber,
    fromToken: InstantTradeToken,
    toToken: InstantTradeToken
  ): Promise<InstantTrade> {
    const fromTokenClone = { ...fromToken };
    const toTokenClone = { ...toToken };

    if (this.web3Public.isNativeAddress(fromToken.address)) {
      fromTokenClone.address = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    }

    if (this.web3Public.isNativeAddress(toToken.address)) {
      toTokenClone.address = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    }

    const ethPrice = await this.coingeckoApiService.getEtherPriceInUsd();
    const gasPrice = await this.web3Public.getGasPriceInETH();

    const params = {
      sellToken: fromTokenClone.address,
      buyToken: toTokenClone.address,
      sellAmount: Web3PublicService.amountToWei(fromAmount, fromToken.decimals),
      slippagePercentage: this.settings.slippageTolerance.toString()
    };

    const trade = await this.fetchTrade(params);
    this.tradeData = trade;
    const gasFeeInEth = new BigNumber(trade.estimatedGas).multipliedBy(gasPrice);
    const gasFeeInUsd = gasFeeInEth.multipliedBy(ethPrice);

    return {
      from: {
        token: fromToken,
        amount: new BigNumber(trade.sellAmount)
      },
      to: {
        token: toToken,
        amount: new BigNumber(trade.buyAmount).div(10 ** toToken.decimals)
      },
      estimatedGas: trade.estimatedGas,
      gasFeeInUsd,
      gasFeeInEth,
      options: {
        gasOptimization: this.settings.rubicOptimisation
      }
    };
  }

  public getAllowance(tokenAddress: string): Observable<BigNumber> {
    return this.commonUniswap.getAllowance(
      tokenAddress,
      this.tradeData.allowanceTarget,
      this.web3Public
    );
  }

  public async approve(
    tokenAddress: string,
    options: {
      onTransactionHash?: (hash: string) => void;
    }
  ): Promise<void> {
    await this.commonUniswap.checkSettings(this.blockchain);
    return this.commonUniswap.approve(tokenAddress, this.tradeData.allowanceTarget, options);
  }

  public fetchTrade(params) {
    return this.http.get(`${this.apiAddress}swap/v1/quote?`, { params }).toPromise();
  }
}
