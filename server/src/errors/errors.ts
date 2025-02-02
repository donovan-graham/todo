import { LogLevel } from "../logging/enums";

export class ApplicationError extends Error {
  public timestamp: number;
  public responseStatusCode: number;
  public logLevel: LogLevel;
  public origin?: Error;
  public meta?: object;

  constructor(error: string | Error, responseStatusCode: number, meta?: object, logLevel?: LogLevel) {
    if (error instanceof Error) {
      super(error.message);
      this.origin = error;
    } else {
      super(error);
    }

    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.responseStatusCode = responseStatusCode;
    this.timestamp = Date.now();
    this.meta = meta;
    this.logLevel = logLevel || LogLevel.Error;
  }

  addMeta(meta: object) {
    this.meta = { ...this.meta, ...meta };
  }
}

export class ApplicationConfigurationError extends ApplicationError {
  constructor(error: string | Error, meta?: object, logLevel?: LogLevel) {
    super(error, 500, meta, logLevel);
  }
}

export class UserNotFoundError extends ApplicationError {
  constructor(error: string | Error, meta?: object, logLevel?: LogLevel) {
    super(error, 400, meta, logLevel);
  }
}

export class UserAlreadyExistsError extends ApplicationError {
  constructor(error: string | Error, meta?: object, logLevel?: LogLevel) {
    super(error, 303, meta, logLevel);
  }
}

export class UserAuthenticationError extends ApplicationError {
  constructor(error: string | Error, meta?: object, logLevel?: LogLevel) {
    super(error, 401, meta, logLevel);
  }
}

export class UserAuthorisationError extends ApplicationError {
  constructor(error: string | Error, meta?: object, logLevel?: LogLevel) {
    super(error, 403, meta, logLevel);
  }
}

export class SchemaValidationError extends ApplicationError {
  constructor(error: string | Error, meta?: object, logLevel?: LogLevel) {
    super(error, 400, meta, logLevel);
  }
}

export class DBConnectionError extends ApplicationError {
  constructor(error: string | Error, meta?: object, logLevel?: LogLevel) {
    super(error, 502, meta, logLevel);
  }
}

export class DBError extends ApplicationError {
  constructor(error: string | Error, meta?: object, logLevel?: LogLevel) {
    super(error, 500, meta, logLevel);
  }
}
export class DBNotFoundError extends ApplicationError {
  constructor(error: string | Error, meta?: object, logLevel?: LogLevel) {
    super(error, 404, meta, logLevel);
  }
}

export class ApiRequestError extends ApplicationError {
  constructor(error: string | Error, responseStatusCode: number, gateway: object, meta?: object, logLevel?: LogLevel) {
    super(error, responseStatusCode, { gateway, ...meta }, logLevel);
  }
}

export class ApiDecodeError extends ApplicationError {
  constructor(error: string | Error, gateway: object, payload: any, meta?: object, logLevel?: LogLevel) {
    super(error, 500, { gateway, payload, ...meta }, logLevel);
  }
}
