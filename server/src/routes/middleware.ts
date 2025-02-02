import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserAuthenticationError } from "../errors/errors";
import { TokenPayload } from "../types";

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req?.headers?.authorization && req?.headers?.authorization?.toLowerCase().startsWith("bearer ")) {
    const token = req.headers.authorization.substring(7);

    let payload;
    try {
      payload = jwt.verify(token, "JWT_SECRET_KEY") as TokenPayload;
    } catch (error) {
      return next(new UserAuthenticationError("invalid bearer token"));
    }

    req.payload = payload;
    return next();
  }

  return next(new UserAuthenticationError("missing bearer token"));
};
