import { Component } from '@angular/core';
import { ContentLoaderService } from 'src/app/core/services/content-loader/content-loader.service';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { CollaborationsContent } from '../../models/content';
import { ListingRequestPopupComponent } from './listing-request-popup/listing-request-popup.component';
import { MessageBoxComponent } from '../message-box/message-box.component';

@Component({
  selector: 'app-collaborations',
  templateUrl: './collaborations.component.html',
  styleUrls: ['./collaborations.component.scss']
})
export class CollaborationsComponent {
  public collaborations: CollaborationsContent[];

  constructor(
    contentLoaderService: ContentLoaderService,
    private dialog: MatDialog,
    private readonly translateService: TranslateService
  ) {
    this.collaborations = contentLoaderService.collaborationsContent;
  }

  public openListingRequestPopup(): void {
    const data = {
      title: this.translateService.instant('tradesPage.listingRequest.title'),
      descriptionComponentClass: ListingRequestPopupComponent
    };
    this.dialog.open(MessageBoxComponent, {
      width: '400px',
      data
    });
  }
}