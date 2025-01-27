import { Request, Response, RequestHandler } from "express";
// import asyncHandler from "express-async-handler";

enum HttpMethod {
  GET = "get",
  POST = "post",
}

interface Route {
  method: HttpMethod;
  path: string;
  handler: RequestHandler;
}

const apiBasePath = "/v1/api";

const healthCheckPath = `${apiBasePath}/health`;

export const healthCheckHandler = (req: Request, res: Response) =>
  res.send("OK");

// export const healthCheckRoute: Route = {
//   method: HttpMethod.GET,
//   path: healthCheckPath,
//   handler: healthCheckHandler, //asyncHandler(healthCheckHandler),
// };
