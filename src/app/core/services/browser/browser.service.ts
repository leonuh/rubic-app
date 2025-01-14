import { Inject, Injectable } from '@angular/core';
import { BROWSER } from 'src/app/shared/models/browser/BROWSER';
import { WINDOW } from 'src/app/core/models/window';
import { IframeService } from 'src/app/core/services/iframe/iframe.service';

@Injectable({
  providedIn: 'root'
})
export class BrowserService {
  private mobileBreakpoint = 500;

  public get currentBrowser(): BROWSER {
    switch (true) {
      case this.window.innerWidth >= this.mobileBreakpoint ||
        (this.iframeService.isIframe && this.iframeService.device === 'desktop'):
        return BROWSER.DESKTOP;
      case !this.window.ethereum:
        return BROWSER.MOBILE;
      case this.window.ethereum?.isMetaMask:
        return BROWSER.METAMASK;
      // @ts-ignore
      case this.window.ethereum?.isWalletLink || this.window.ethereum?.isCoinbaseWallet:
        return BROWSER.COINBASE;
      default:
        return BROWSER.DESKTOP;
    }
  }

  constructor(
    @Inject(WINDOW) private window: Window,
    private readonly iframeService: IframeService
  ) {}
}
