import { Router, Request, Response } from "express";
import { z } from "zod";
import { SchemaValidationError } from "../errors/errors";
import { fetchAllUsers, fetchUserById } from "../db/queries";
import { isAuthenticated } from "./middleware";

const getAllUsersHandler = async (req: Request, res: Response) => {
  const [error, users] = await fetchAllUsers();
  if (error) {
    throw new Error("failed to fetch users");
  }
  return res.json(users);
};

const getUserApiParamsSchema = z.object({
  userId: z.string().uuid(),
});

const getUserHandler = async (req: Request, res: Response) => {
  const { success, error: schemaError, data: safeParams } = getUserApiParamsSchema.safeParse(req.params);
  if (!success) {
    throw new SchemaValidationError(schemaError?.message);
  }

  const [error, user] = await fetchUserById(safeParams.userId);
  if (error) {
    throw error;
  }

  return res.json(user);
};

const router = Router();
router.use(isAuthenticated);
router.get("/api/v1/users", getAllUsersHandler);
router.get("/api/v1/users/:userId", getUserHandler);

export default router;
