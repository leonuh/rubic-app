import { RubicError } from 'src/app/core/errors/models/RubicError';

class CustomError extends RubicError {
  constructor(message: string, displayError?: boolean) {
    super(
      'text',
      null,
      message.charAt(0).toUpperCase() + message.slice(1),
      null,
      null,
      displayError
    );
    Object.setPrototypeOf(this, CustomError.prototype);
  }
}

export default CustomError;
