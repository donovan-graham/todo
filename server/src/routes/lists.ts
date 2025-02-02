import { Router, Request, Response } from "express";
import { z } from "zod";
import { SchemaValidationError } from "../errors/errors";
import { createNewList, fetchListById, fetchListsByUserId } from "../db/queries";
import { isAuthenticated } from "./middleware";

const getAllListsHandler = async (req: Request, res: Response) => {
  const [error, lists] = await fetchListsByUserId(req.payload.userId);
  if (error) {
    throw error;
  }

  return res.json(lists);
};

const postListsApiBodySchema = z.object({
  name: z.string().trim().max(255),
});

const postListHandler = async (req: Request, res: Response) => {
  const { success, error: schemaError, data: safeBody } = postListsApiBodySchema.safeParse(req.body);
  if (!success) {
    throw new SchemaValidationError(schemaError?.message);
  }

  const [error, list] = await createNewList(req.payload?.userId, safeBody.name);
  if (error) {
    throw error;
  }

  return res.json(list);
};

const getListByIdApiParamSchema = z.object({
  listId: z.string().trim().max(255),
});

const getListHandler = async (req: Request, res: Response) => {
  const { success, error: schemaError, data: safeParams } = getListByIdApiParamSchema.safeParse(req.params);
  if (!success) {
    throw new SchemaValidationError(schemaError?.message);
  }

  const [error, list] = await fetchListById(safeParams.listId);
  if (error) {
    throw error;
  }

  return res.json(list);
};

const router = Router();
router.use(isAuthenticated);
router.get("/api/v1/lists/:listId", getListHandler);
router.post("/api/v1/lists", postListHandler);
router.get("/api/v1/lists", getAllListsHandler);

export default router;
