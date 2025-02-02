import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";
import { SchemaValidationError, UserAlreadyExistsError, UserAuthenticationError } from "../errors/errors";
import { createNewUser, fetchUserByUsername } from "../db/queries";
import { TokenPayload } from "../types";
import { StatusCodes } from "http-status-codes";

const createAuthToken = (payload: TokenPayload) =>
  jwt.sign(payload, "JWT_SECRET_KEY", {
    expiresIn: 24 * 60 * 60, // 1 day
  });

const postLoginApiBodySchema = z.object({
  username: z.string().trim().min(3).max(255),
  password: z.string().trim().min(3).max(255),
});

const loginHandler = async (req: Request, res: Response) => {
  const { success, error: schemaError, data: safeBody } = postLoginApiBodySchema.safeParse(req.body);

  if (!success) {
    throw new SchemaValidationError(schemaError?.message);
  }

  const [userError, user] = await fetchUserByUsername(safeBody.username);
  if (userError) {
    throw userError;
  }

  if (!bcrypt.compareSync(safeBody.password, user.password_hash)) {
    throw new UserAuthenticationError("invalid username or password");
  }

  const token = createAuthToken({
    userId: user.id,
    username: user.username,
    createdAt: user.created_at,
  });

  return res.json({ id: user.id, token });
};

const postRegisterApiBodySchema = z.object({
  username: z.string().trim().min(3).max(255),
  password: z.string().trim().min(3).max(255),
});

export const registerHandler = async (req: Request, res: Response) => {
  const { success, error: schemaError, data: safeBody } = postRegisterApiBodySchema.safeParse(req.body);
  if (!success) {
    throw new SchemaValidationError(schemaError?.message);
  }

  const [userError, userFound] = await fetchUserByUsername(safeBody.username);
  if (!userError || userFound) {
    throw new UserAlreadyExistsError("username already exists");
  }

  const salt = bcrypt.genSaltSync(10);
  const password_hash = bcrypt.hashSync(safeBody.password, salt);

  const [createError, user] = await createNewUser(safeBody.username, password_hash);
  if (createError) {
    throw createError;
  }

  const token = createAuthToken({
    userId: user.id,
    username: user.username,
    createdAt: user.created_at,
  });

  return res.status(StatusCodes.CREATED).json({ id: user.id, token });
};

const router = Router();
router.post("/api/v1/login", loginHandler);
router.post("/api/v1/register", registerHandler);

export default router;
