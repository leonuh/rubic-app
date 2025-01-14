import { ERROR_TYPE } from 'src/app/core/errors/models/error-type';
import { Type } from '@angular/core';

type TranslationKey = string;

type Component = Type<object>;

export abstract class RubicError<T extends ERROR_TYPE> extends Error {
  public translateKey: TranslationKey;

  public type: ERROR_TYPE;

  public component: Component;

  public data: object;

  public displayError = true;

  protected constructor(
    contentProvider: T extends ERROR_TYPE.TEXT
      ? TranslationKey
      : T extends ERROR_TYPE.COMPONENT
      ? Component
      : null,
    data?: object,
    message?: string
  ) {
    super(message);
    this.data = data;

    if (!contentProvider) {
      this.type = ERROR_TYPE.RAW_MESSAGE;
      return;
    }

    if (typeof contentProvider === 'string') {
      this.translateKey = contentProvider;
      this.type = ERROR_TYPE.TEXT;
      return;
    }

    this.component = contentProvider;
    this.type = ERROR_TYPE.COMPONENT;
  }
}
