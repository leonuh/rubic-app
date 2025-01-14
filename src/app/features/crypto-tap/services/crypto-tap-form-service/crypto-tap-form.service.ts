import { Injectable } from '@angular/core';
import { FormControl, FormGroup } from '@ngneat/reactive-forms';
import { BLOCKCHAIN_NAME } from 'src/app/shared/models/blockchain/BLOCKCHAIN_NAME';
import { TokenAmount } from 'src/app/shared/models/tokens/TokenAmount';
import BigNumber from 'bignumber.js';
import { FormService } from 'src/app/shared/models/swaps/FormService';
import {
  CryptoTapForm,
  CryptoTapFormInput,
  CryptoTapFormOutput
} from 'src/app/features/crypto-tap/models/CryptoTapForm';
import { Observable } from 'rxjs';

@Injectable()
export class CryptoTapFormService implements FormService {
  public commonTrade: FormGroup<CryptoTapForm>;

  public get input(): FormGroup<CryptoTapFormInput> {
    return this.commonTrade.controls.input;
  }

  public get inputValue(): CryptoTapFormInput {
    return this.input.value;
  }

  public get inputValueChanges(): Observable<CryptoTapFormInput> {
    return this.input.valueChanges;
  }

  public get output(): FormGroup<CryptoTapFormOutput> {
    return this.commonTrade.controls.output;
  }

  public get outputValue(): CryptoTapFormOutput {
    return this.output.value;
  }

  public get outputValueChanges(): Observable<CryptoTapFormOutput> {
    return this.output.valueChanges;
  }

  constructor() {
    this.commonTrade = new FormGroup<CryptoTapForm>({
      input: new FormGroup<CryptoTapFormInput>({
        fromBlockchain: new FormControl<BLOCKCHAIN_NAME>(BLOCKCHAIN_NAME.ETHEREUM),
        toBlockchain: new FormControl<BLOCKCHAIN_NAME>(BLOCKCHAIN_NAME.BINANCE_SMART_CHAIN),
        fromToken: new FormControl<TokenAmount>(),
        toToken: new FormControl<TokenAmount>()
      }),
      output: new FormGroup<CryptoTapFormOutput>({
        toAmount: new FormControl<BigNumber>(new BigNumber(0)),
        fee: new FormControl<{ token: TokenAmount; amount: BigNumber }>({
          token: null,
          amount: new BigNumber(0)
        }),
        fromAmount: new FormControl<BigNumber>(new BigNumber(0))
      })
    });
  }
}
