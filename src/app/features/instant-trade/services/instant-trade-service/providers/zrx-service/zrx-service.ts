import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { TransactionReceipt } from 'web3-eth';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ItProvider } from '../../models/it-provider';
import InstantTrade from '../../../../models/InstantTrade';
import InstantTradeToken from '../../../../models/InstantTradeToken';
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
import { UseTestingModeService } from '../../../../../../core/services/use-testing-mode/use-testing-mode.service';
import { ZRX_API_ADDRESS, ZRX_NATIVE_TOKEN } from './zrx-eth-constants';
import { SwapFormService } from '../../../../../swaps/services/swaps-form-service/swap-form.service';
import { ZrxApiResponse } from '../../models/zrx-types';
import { HttpService } from '../../../../../../core/services/http/http.service';

@Injectable({
  providedIn: 'root'
})
export class ZrxService implements ItProvider {
  private web3Public: Web3Public;

  private settings: ItSettingsForm;

  private tradeData: ZrxApiResponse;

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
    private readonly useTestingModeService: UseTestingModeService,
    private readonly swapFormService: SwapFormService,
    private readonly httpService: HttpService
  ) {
    this.swapFormService.commonTrade.controls.input.valueChanges.subscribe(({ fromBlockchain }) => {
      this.web3Public = this.w3Public[fromBlockchain];
      this.blockchain = BLOCKCHAIN_NAME[fromBlockchain];
      this.apiAddress = ZRX_API_ADDRESS[fromBlockchain];
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
      fromTokenClone.address = ZRX_NATIVE_TOKEN;
    }

    if (this.web3Public.isNativeAddress(toToken.address)) {
      toTokenClone.address = ZRX_NATIVE_TOKEN;
    }

    const ethPrice = await this.coingeckoApiService.getEtherPriceInUsd();
    const gasPrice = await this.web3Public.getGasPriceInETH();

    const params = {
      sellToken: fromTokenClone.address,
      buyToken: toTokenClone.address,
      sellAmount: Web3PublicService.amountToWei(fromAmount, fromToken.decimals),
      slippagePercentage: this.settings.slippageTolerance.toString()
    };

    this.tradeData = await this.fetchTrade(params);
    const gasFeeInEth = new BigNumber(this.tradeData.estimatedGas).multipliedBy(gasPrice);
    const gasFeeInUsd = gasFeeInEth.multipliedBy(ethPrice);

    return {
      from: {
        token: fromToken,
        amount: new BigNumber(this.tradeData.sellAmount)
      },
      to: {
        token: toToken,
        amount: new BigNumber(this.tradeData.buyAmount).div(10 ** toToken.decimals)
      },
      estimatedGas: new BigNumber(this.tradeData.estimatedGas),
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

  public fetchTrade(params): Promise<ZrxApiResponse> {
    return this.httpService.get('swap/v1/quote', params, this.apiAddress).toPromise();
  }
}
