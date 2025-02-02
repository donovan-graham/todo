import { TokenPayload } from "../types";
import jwt from "jsonwebtoken";

export const createAuthToken = (payload: TokenPayload) =>
  jwt.sign(payload, "JWT_SECRET_KEY", {
    expiresIn: 24 * 60 * 60, // 1 day
  });
