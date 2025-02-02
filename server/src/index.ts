import express, { Request, Response } from "express";
import path from "path";
import helmet from "helmet";
import { Redis, RedisOptions } from "ioredis";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";

import { ReasonPhrases, StatusCodes } from "http-status-codes";
import http from "http";

import jwt from "jsonwebtoken";
import bodyParser from "body-parser";

import { z } from "zod";
import "express-async-errors";
import { v4 as uuid } from "uuid";

import { generateKeyBetween } from "fractional-indexing";

import { Queue, Worker } from "bullmq";

import { pool } from "./db/connection";
import {
  fetchAllUsers,
  fetchUserById,
  fetchListsByUserId,
  createNewList,
  fetchListById,
  createNewTodo,
  findTodoNextPosition,
  updateTodoTransitionStatus,
  updateTodoDescription,
  updateTodoPosition,
} from "./db/queries";
import { TODO_STATUS } from "./db/enums";
import { requestLogger, errorHandler } from "./logging/logger";
import { SchemaValidationError } from "./errors/errors";
import { isStatusTransitionValid } from "./rules";

import { TokenPayload } from "./types";

import { router } from "./routes";
import { isAuthenticated } from "./routes/middleware";

const assetPath = path.join(__dirname, "app");
const staticPath = path.join(__dirname, "static");

const redisOpts: RedisOptions = {
  port: 6379,
  host: "127.0.0.1", // localhost
  username: "default",
  password: "redis_password",
};

declare module "node:http" {
  interface IncomingMessage {
    payload: TokenPayload;
  }
}

const app = express();

// TODO: Create HTTPS server with self-signed certificate
const server = http.createServer(app);

const redisPubClient = new Redis(redisOpts);
const redisSubClient = redisPubClient.duplicate();

const io = new SocketIOServer(server, {
  adapter: createAdapter(redisPubClient, redisSubClient),
  cors: {
    origin: "*",
  },
});

app.set("trust proxy", true);

app.use(helmet());
// app.use((req, res, next) => {
//   const origin = req.get("origin") || "*";
//   res.header("Access-Control-Allow-Origin", origin);
//   res.header("Access-Control-Allow-Headers", "X-Requested-With");
//   next();
// });

// Initialize session storage.
// app.use(sessionMiddleware);

// parse json body
app.use(bodyParser.json());

// static assets
app.use("/v1/assets", express.static(assetPath));
app.use("/v1/static", express.static(staticPath));
app.get("/favicon.ico", (_, res) => res.sendFile(path.join(staticPath, "favicon.ico")));

// start logging after static assets
app.use(requestLogger);

app.use(router);

// unathenticated requests

app.get("/api/v1/welcome", (req: Request, res: Response) => {
  const socketId = req.query.sid || "";
  if (socketId) {
    io.to(socketId as string).emit("chat", "welcome back!!");
  } else {
    io.sockets.emit("chat", "welcome welcome welcome");
  }

  return res.send("OK");
});

// authenticated requests

app.get("/api/v1/users", isAuthenticated, async (req: Request, res: Response) => {
  const [error, users] = await fetchAllUsers();
  if (error) {
    throw new Error("failed to fetch users");
  }
  return res.json(users);
});

const getUserApiParamsSchema = z.object({
  userId: z.string().uuid(),
});

app.get("/api/v1/users/:userId", isAuthenticated, async (req: Request, res: Response) => {
  const { success, error: schemaError, data: safeParams } = getUserApiParamsSchema.safeParse(req.params);
  if (!success) {
    throw new SchemaValidationError(schemaError?.message);
  }

  const [error, user] = await fetchUserById(safeParams.userId);
  if (error) {
    throw error;
  }

  return res.json(user);
});

app.get("/api/v1/lists", isAuthenticated, async (req: Request, res: Response) => {
  const [error, lists] = await fetchListsByUserId(req.payload.userId);
  if (error) {
    throw error;
  }

  return res.json(lists);
});

const postListsApiBodySchema = z.object({
  name: z.string().trim().max(255),
});

app.post("/api/v1/lists", isAuthenticated, async (req: Request, res: Response) => {
  const { success, error: schemaError, data: safeBody } = postListsApiBodySchema.safeParse(req.body);
  if (!success) {
    throw new SchemaValidationError(schemaError?.message);
  }

  const [error, list] = await createNewList(req.payload?.userId, safeBody.name);
  if (error) {
    throw error;
  }

  return res.json(list);
});

const getListByIdApiParamSchema = z.object({
  listId: z.string().trim().max(255),
});

app.get("/api/v1/lists/:listId", isAuthenticated, async (req: Request, res: Response) => {
  const { success, error: schemaError, data: safeParams } = getListByIdApiParamSchema.safeParse(req.params);
  if (!success) {
    throw new SchemaValidationError(schemaError?.message);
  }

  const [error, list] = await fetchListById(safeParams.listId);
  if (error) {
    throw error;
  }

  return res.json(list);
});

const getListRoomKey = (listId: string) => `list:${listId}`;

const postTodosApiBodySchema = z.object({
  listId: z.string().uuid(),
  description: z.string().optional(),
});

app.post("/api/v1/todos", isAuthenticated, async (req: Request, res: Response) => {
  const { success, error: schemaError, data: safeBody } = postTodosApiBodySchema.safeParse(req.body);
  if (!success) {
    throw new SchemaValidationError(schemaError?.message);
  }

  const todoId = uuid();

  // TODO: logically these 2 db statements need to be run in the single worked serial queue and/or wrapped in a transaction/lock/latch structure
  // i.e. postgres row-level locking (or another in-memory db which provides guarantees); or node redlock for distributed locks using redis; or isolation level
  // https://node-postgres.com/features/transactions

  // https://www.postgresql.org/docs/current/transaction-iso.html#XACT-SERIALIZABLE

  // https://medium.com/@darora8/transaction-isolation-in-postgres-ec4d34a65462

  // https://www.postgresql.org/docs/current/explicit-locking.html#EXPLICIT-LOCKING

  // const client = await pool.connect();
  // try {
  //   await client.query("BEGIN");
  //   const queryText = "INSERT INTO users(name) VALUES($1) RETURNING id";
  //   const res = await client.query(queryText, ["brianc"]);

  //   const insertPhotoText =
  //     "INSERT INTO photos(user_id, photo_url) VALUES ($1, $2)";
  //   const insertPhotoValues = [res.rows[0].id, "s3.bucket.foo"];
  //   await client.query(insertPhotoText, insertPhotoValues);

  //   await client.query("COMMIT");
  // } catch (e) {
  //   await client.query("ROLLBACK");
  //   throw e;
  // } finally {
  //   client.release();
  // }

  await processor.addJob(safeBody.listId, uuid(), "create_todo", {
    todoId,
    listId: safeBody.listId,
    userId: req.payload.userId,
    description: safeBody.description,
  });

  return res.status(StatusCodes.ACCEPTED).send(ReasonPhrases.ACCEPTED);
});

// catch all handlers
app.get("/", (req: Request, res: Response) => {
  res.status(200).send("OK");
});

app.get("*", (req: Request, res: Response) => res.redirect("/"));

// Error handling
app.use(errorHandler);
// app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
//   if (err instanceof CustomError) {
//     const { statusCode, errors, logging } = err;
//     if (logging) {
//       console.error(
//         JSON.stringify(
//           {
//             code: err.statusCode,
//             errors: err.errors,
//             stack: err.stack,
//           },
//           null,
//           2
//         )
//       );
//     }

//     return res.status(statusCode).send({ errors });
//   }

//   // Unhandled errors
//   console.error(JSON.stringify(err, null, 2));
//   return res
//     .status(500)
//     .send({ errors: [{ message: "Something went wrong" }] });
// });

// Acceess handlers

const dbGetTodos = async (listId: number) => {
  const query = {
    text: "SELECT * FROM todos WHERE list_id = $1",
    values: [listId],
  };

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    console.error(e);
    throw e;
  }

  return result.rows;
};

io.use(async (socket, next) => {
  if (socket.connected) {
    return next();
  }

  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error("[400] missing auth token"));
  }

  let payload;
  try {
    payload = jwt.verify(token, "JWT_SECRET_KEY") as TokenPayload;
  } catch (error) {
    return next(new Error("[401] invalid token"));
  }

  socket.request.payload = payload;
  return next();
});

io.on("connection", async (socket) => {
  // console.log(socket.handshake.auth); // prints { token: "abcd" }
  console.log("user connection");

  const roomKey = getListRoomKey(socket.handshake.auth.listId);

  // redis.has(key)

  // const hasRoom = io.sockets.rooms.has(roomKey);

  // if (!hasRoom) {
  //   console.log(">>> need to create a new room!!! worker");
  // }

  console.log("joining room:", roomKey);
  socket.join(getListRoomKey(socket.handshake.auth.listId));

  // const checkKey = await redisPubClient.get("mykey");
  socket.on("fetch_list", async ({ listId }: { listId: number }) => {
    // const { userId } = socket.request.payload;
    const results = await dbGetTodos(listId);

    // only reply on this socket
    socket.emit("fetch_list_result", { listId, results });
  });

  socket.on("create_todo", async ({ listId, todoId, position }: { listId: string; todoId: string; position: string }) => {
    const { userId } = socket.request.payload;

    await processor.addJob(listId, uuid(), "create_todo", {
      todoId,
      listId,
      userId,
      position,
    });
  });

  socket.on("update_todo_description", async ({ listId, todoId, description }: { listId: string; todoId: string; description: string }) => {
    // const { userId } = socket.request.payload;
    await processor.addJob(listId, uuid(), "update_todo_description", {
      todoId,
      listId,
      description,
    });
  });

  socket.on("transition_todo_status", async ({ listId, todoId, fromStatus, toStatus }: { listId: string; todoId: string; fromStatus: TODO_STATUS; toStatus: TODO_STATUS }) => {
    // const { userId } = socket.request.payload;
    await processor.addJob(listId, uuid(), "transition_todo_status", {
      todoId,
      listId,
      fromStatus,
      toStatus,
    });
  });

  socket.on("move_todo", async ({ listId, todoId, position }: { listId: string; todoId: string; position: string }) => {
    // const { userId } = socket.request.payload;
    await processor.addJob(listId, uuid(), "move_todo", {
      todoId,
      listId,
      position,
    });
  });

  // create_todo

  socket.on("chat", (msg) => {
    const payload = socket.request.payload;

    console.log("chat message: ", msg, payload.username);
    io.emit("chat", `Server received: ${msg} ${payload.username}`);
  });

  socket.on("disconnect", () => {
    // HOW
    console.log("user disconnected");
  });
});

const redisConnection = new Redis({ ...redisOpts, maxRetriesPerRequest: null });

const handleJob = async (job: any) => {
  console.log("job: ", job.name, job.id, job.data);

  switch (job.name) {
    case "create_todo": {
      const { todoId, listId, userId, description } = job.data;

      let position = undefined;
      if (!position) {
        const [positionError, lastPosition] = await findTodoNextPosition(listId);

        if (positionError) {
          console.error(positionError);
          return;
        }

        position = generateKeyBetween(lastPosition, undefined);
      }

      const [error, todo] = await createNewTodo(todoId, listId, userId, position, description);
      if (error) {
        console.error(error);
        return;
      }

      io.to(getListRoomKey(listId)).emit("create_todo_result", {
        listId,
        results: todo,
      });

      break;
    }
    case "update_todo_description": {
      const { todoId, listId, description } = job.data;

      const [error, updatedAt] = await updateTodoDescription(todoId, listId, description);
      if (error) {
        console.error(error);
        return;
      }

      io.to(getListRoomKey(listId)).emit("update_todo_description_result", {
        listId,
        results: {
          todo_id: todoId,
          description,
          updated_at: updatedAt,
        },
      });

      break;
    }
    case "transition_todo_status": {
      const { todoId, listId, fromStatus, toStatus } = job.data;

      if (!isStatusTransitionValid(fromStatus, toStatus)) {
        console.error(`Invalid status transition from ${fromStatus} to ${toStatus} for todo ${todoId}`);
        return;
      }

      const [error, updatedAt] = await updateTodoTransitionStatus(todoId, listId, fromStatus, toStatus);

      if (error) {
        console.error(error);
        return;
      }

      io.to(getListRoomKey(listId)).emit("transition_todo_status_result", {
        listId,
        results: {
          todo_id: todoId,
          status: toStatus,
          updated_at: updatedAt,
        },
      });

      break;
    }
    case "move_todo": {
      const { todoId, listId, position } = job.data;

      const [error, updatedAt] = await updateTodoPosition(todoId, listId, position);

      if (error) {
        console.error(error);
        return;
      }

      io.to(getListRoomKey(listId)).emit("move_todo_result", {
        listId,
        results: {
          todo_id: todoId,
          position,
          updated_at: updatedAt,
        },
      });

      break;
    }
    default:
      console.error("unknown job name: ", job.name);
      break;
  }
};

class Processor {
  queues: { [key: string]: Queue } = {};
  workers: { [key: string]: Worker } = {};

  constructor() {}

  async addQueue(listId: string) {
    if (listId in this.queues) {
      return;
    }

    const queue = new Queue(listId, { connection: redisConnection });
    await queue.setGlobalConcurrency(1);
    this.queues[listId] = queue;
  }

  async addWorker(listId: string) {
    if (listId in this.workers) {
      return;
    }

    this.workers[listId] = new Worker(listId, handleJob, {
      connection: redisConnection,
    });
  }

  // https://docs.bullmq.io/guide/jobs/job-ids
  // Custom job ids must not contain the : separator as it will be translated in 2 different values, since we are also following Redis naming convention. So if you need to add a separator, use a different value, for example -, _.
  async addJob(listId: string, jobId: string, jobName: string, job: any) {
    await this.addQueue(listId);
    await this.addWorker(listId);
    await this.queues[listId]?.add(jobName, job, { jobId });
  }
}

const processor = new Processor();

const PORT = 3000;
server.listen(PORT, function () {
  console.log(`Listening on http://localhost:${PORT}`);
});

process.on("SIGINT", async () => {
  console.log("Received SIGINT. Closing server...");
  await pool.end();
  await server.close();
  process.exit(0);
});

/// https://socketio.p2hp.com/how-to/use-with-express-session/
