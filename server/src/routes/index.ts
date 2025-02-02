import { Router } from "express";

import authRouter from "./auth";

const router = Router();

// login and register routes
router.use(authRouter);

export { router };
