import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';
import { TransactionReceipt } from 'web3-eth';
import { Observable } from 'rxjs';
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

@Injectable({
  providedIn: 'root'
})
export class ZrxEthService implements ItProvider {
  private web3Public: Web3Public;

  private settings: ItSettingsForm;

  constructor(
    private http: HttpClient,
    private readonly settingsService: SettingsService,
    private readonly w3Public: Web3PublicService,
    private readonly coingeckoApiService: CoingeckoApiService
  ) {
    this.web3Public = this.w3Public[BLOCKCHAIN_NAME.ETHEREUM_TESTNET];
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
    console.log('create trade zrx');
    return Promise.resolve();
  }

  public async calculateTrade(
    fromAmount: BigNumber,
    fromToken: InstantTradeToken,
    toToken: InstantTradeToken
  ): Promise<InstantTrade> {

    const params = {
      sellToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      buyToken: toToken.address,
      sellAmount: Web3PublicService.amountToWei(fromAmount, fromToken.decimals),
      slippagePercentage: this.settings.slippageTolerance.toString()
    };

    const ethPrice = await this.coingeckoApiService.getEtherPriceInUsd();
    const gasPrice = await this.web3Public.getGasPriceInETH();

    const trade = await this.fetchTrade(params);
    const gasFeeInEth = new BigNumber(trade.estimatedGas).multipliedBy(gasPrice);
    const gasFeeInUsd = gasFeeInEth.multipliedBy(ethPrice);

    return {
      from: {
        token: trade.sellTokenAddress,
        amount: new BigNumber(trade.sellAmount)
      },
      to: {
        token: trade.buyTokenAddress,
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
    console.log('get allowance zrx');
    return Promise.resolve();
  }

  public async approve(provider: INSTANT_TRADES_PROVIDER, trade: InstantTrade): Promise<void> {
    console.log('approve zrx');
    return Promise.resolve();
  }

  public fetchTrade(params) {
    return this.http.get('https://kovan.api.0x.org/swap/v1/quote', { params }).toPromise();
  }
}
