import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

import { ApplicationError } from "../errors/errors";
import { LogLevel, LogType } from "./enums";

type LogMethod = "error" | "warn" | "info" | "debug";

const loggerMap: { [k in LogLevel]: LogMethod } = {
  [LogLevel.Panic]: "error",
  [LogLevel.Alert]: "error",
  [LogLevel.Critical]: "error",
  [LogLevel.Error]: "error",
  [LogLevel.Warn]: "warn",
  [LogLevel.Notice]: "info",
  [LogLevel.Info]: "info",
  [LogLevel.Debug]: "debug",
};

const sizeLimit = 1024 * 4; // 4kb

const slice = (payload: any, limit: number = sizeLimit) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("utf8", 0, limit);

const prettyStack = (error: ApplicationError) =>
  // @ts-ignore
  error.stack
    .toString()
    .split("\n")
    .filter((s: string) => !s.includes("(<anonymous>)"))
    .map((s: string) => s.replace("/service/server/", ""))
    .join("\n");

const requestInfo = (request: Request) => ({
  // request_headers: request.headers,
  method: request.method,
  path: `${request.baseUrl}${request.path}`,
  query_string: request.query,
  request_content_type: request.get("content-type"),
  request_body: request.body ? slice(request.body) : "",
  remote_ip:
    request.ip ||
    request.connection?.remoteAddress ||
    request.socket?.remoteAddress,
  remote_port: request.connection?.remotePort || request.socket?.remotePort,
});

const errorInfo = (error: ApplicationError | Error) => {
  if (error instanceof ApplicationError) {
    return {
      timestamp: error.timestamp,
      error_name: error.name,
      full_message: error.stack ? prettyStack(error) : JSON.stringify(error),
      meta: error.meta ? slice(error.meta) : undefined,
    };
  }

  return {
    timestamp: Date.now(),
    error_name: error.name,
    full_message: JSON.stringify(error),
  };
};

export const requestLogger = (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  if (request.is("multipart/form-data") === "multipart/form-data") {
    return next();
  }

  const start = process.hrtime.bigint();
  // tslint:disable-next-line
  console.log(
    JSON.stringify(
      {
        level_name: LogLevel.Info,
        type: LogType.Request,
        timestamp: Date.now(),
        full_message: `Request ${request.method} ${request.url}`,
        ...requestInfo(request),
      },
      null,
      2
    )
  );

  response.on("finish", () => {
    console.log(
      JSON.stringify(
        {
          level_name: response.statusCode < 400 ? LogLevel.Info : LogLevel.Warn,
          type: LogType.Response,
          timestamp: Date.now(),
          full_message: `Response ${response.statusCode} to ${request.method} ${request.url}`,
          response_status_code: response.statusCode,
          response_body_size: response.get("Content-Length"),
          duration: (
            (process.hrtime.bigint() - start) /
            BigInt(1000000)
          ).toString(),
          ...requestInfo(request),
        },
        null,
        2
      )
    );
  });

  next();
};

export const errorRequestLogger = (
  error: ApplicationError | Error,
  request: Request
) => {
  const logger =
    error instanceof ApplicationError
      ? console[loggerMap[error.logLevel as LogLevel]]
      : console.error;

  logger(
    JSON.stringify(
      {
        level_name:
          error instanceof ApplicationError ? error.logLevel : LogLevel.Error,
        type: LogType.Error,
        ...requestInfo(request),
        ...errorInfo(error),
      },
      null,
      2
    )
  );
};

export const errorHandler = (
  error: ApplicationError | Error,
  request: Request,
  response: Response,
  _: NextFunction
) => {
  errorRequestLogger(error, request);

  if (error instanceof ApplicationError) {
    return response.status(error.responseStatusCode).end();
  }

  return response.status(StatusCodes.INTERNAL_SERVER_ERROR).end();
};
