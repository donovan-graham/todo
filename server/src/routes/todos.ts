import { Router, Request, Response } from "express";
import { z } from "zod";
import { SchemaValidationError } from "../errors/errors";
import { fetchAllUsers, fetchUserById } from "../db/queries";
import { isAuthenticated } from "./middleware";
import { ReasonPhrases, StatusCodes } from "http-status-codes";
import { v4 as uuid } from "uuid";
import { JobProcessor } from "../jobs/processor";
import { JobNames } from "../jobs/enums";

const postTodosApiBodySchema = z.object({
  listId: z.string().uuid(),
  description: z.string().optional(),
});

const postTodoHandlerFactory = (jobProcessor: JobProcessor) => async (req: Request, res: Response) => {
  const { success, error: schemaError, data: safeBody } = postTodosApiBodySchema.safeParse(req.body);
  if (!success) {
    throw new SchemaValidationError(schemaError?.message);
  }

  await jobProcessor.addJob(safeBody.listId, uuid(), JobNames.CreateTodo, {
    todoId: uuid(),
    listId: safeBody.listId,
    userId: req.payload.userId,
    description: safeBody.description,
  });

  return res.status(StatusCodes.ACCEPTED).send(ReasonPhrases.ACCEPTED);
};

export const createRouter = (jobProcessor: JobProcessor) => {
  const router = Router();
  router.use(isAuthenticated);
  router.post("/api/v1/todos", postTodoHandlerFactory(jobProcessor));
  return router;
};
