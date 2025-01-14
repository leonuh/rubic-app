import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from 'src/app/shared/shared.module';
import { A11yModule } from '@angular/cdk/a11y';
import { OverlayModule } from '@angular/cdk/overlay';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { InlineSVGModule } from 'ng-inline-svg';
import {
  TuiDataListModule,
  TuiGroupModule,
  TuiHintModule,
  TuiHostedDropdownModule
} from '@taiga-ui/core';
import { IframeLogoutButtonComponent } from 'src/app/core/header/components/header/components/iframe-logout-button/iframe-logout-button.component';
import { TuiBadgeModule } from '@taiga-ui/kit';
import { LoginButtonComponent } from './components/header/components/login-button/login-button.component';
import { MobileMenuTogglerComponent } from './components/header/components/mobile-menu-toggler/mobile-menu-toggler.component';
import { UserProfileComponent } from './components/header/components/user-profile/user-profile.component';
import { HeaderComponent } from './components/header/header.component';
import { RubicMenuComponent } from './components/header/components/rubic-menu/rubic-menu.component';
import { IframeSettingsButtonComponent } from './components/header/components/iframe-settings-button/iframe-settings-button.component';

@NgModule({
  declarations: [
    HeaderComponent,
    LoginButtonComponent,
    UserProfileComponent,
    MobileMenuTogglerComponent,
    RubicMenuComponent,
    IframeLogoutButtonComponent,
    IframeSettingsButtonComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    TranslateModule,
    RouterModule,
    BrowserAnimationsModule,
    A11yModule,
    OverlayModule,
    InlineSVGModule.forRoot(),
    TuiDataListModule,
    TuiHintModule,
    TuiHostedDropdownModule,
    TuiGroupModule,
    TuiBadgeModule
  ],
  exports: [HeaderComponent, LoginButtonComponent]
})
export class HeaderModule {}
