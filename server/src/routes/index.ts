import { Router } from "express";

import authRouter from "./auth";
import usersRouter from "./users";
import listsRouter from "./lists";
import { createRouter as createTodosRouter } from "./todos";
import { JobProcessor } from "../jobs/processor";

export const createRouter = (jobProcessor: JobProcessor) => {
  const router = Router();

  // login and register routes
  router.use(authRouter);
  router.use(usersRouter);
  router.use(listsRouter);
  router.use(createTodosRouter(jobProcessor));

  return router;
};
