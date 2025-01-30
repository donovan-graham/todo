import express, { NextFunction, Request, Response } from "express";
import path from "path";
import helmet from "helmet";
import { Redis, RedisOptions } from "ioredis";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";

import { ReasonPhrases, StatusCodes } from "http-status-codes";
// import session from "express-session";
// import { RedisStore } from "connect-redis";
import http, { get } from "http";
import pg from "pg";
import jwt from "jsonwebtoken";
import bodyParser from "body-parser";

import { z, ZodError } from "zod";
import "express-async-errors";
import bcrypt from "bcrypt";
import { v4 as uuid } from "uuid";

import { generateKeyBetween } from "fractional-indexing";

import { Queue, Worker } from "bullmq";

const redisOpts: RedisOptions = {
  port: 6379,
  host: "127.0.0.1", // localhost
  username: "default",
  password: "redis_password",
};

interface TokenPayload {
  userId: string;
  username: string;
  createdAt: string;
}

declare module "node:http" {
  interface IncomingMessage {
    payload: TokenPayload;
  }
}

type CustomErrorContent = {
  message: string;
  context?: { [key: string]: any };
};

// https://medium.com/@xiaominghu19922/proper-error-handling-in-express-server-with-typescript-8cd4ffb67188
abstract class CustomError extends Error {
  abstract readonly statusCode: StatusCodes;
  abstract readonly errors: CustomErrorContent[];
  abstract readonly logging: boolean;

  constructor(message: string) {
    super(message);

    // Only because we are extending a built in class
    Object.setPrototypeOf(this, CustomError.prototype);
  }
}

class BadRequestError extends CustomError {
  private static readonly _statusCode = StatusCodes.BAD_REQUEST;
  private readonly _code: number;
  private readonly _logging: boolean;
  private readonly _context: { [key: string]: any };

  constructor(params?: {
    code?: number;
    message?: string;
    logging?: boolean;
    context?: { [key: string]: any };
  }) {
    const { code, message, logging } = params || {};

    super(message || ReasonPhrases.BAD_REQUEST);
    this._code = code || StatusCodes.BAD_REQUEST;
    this._logging = logging || false;
    this._context = params?.context || {};

    // Only because we are extending a built in class
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }

  get errors() {
    return [{ message: this.message, context: this._context }];
  }

  get statusCode() {
    return this._code;
  }

  get logging() {
    return this._logging;
  }
}

// const redisStore = new RedisStore({
//   client: redisPubClient,
//   prefix: "poolside:",
// });

const { Pool } = pg;

const pool = new Pool({
  host: "127.0.0.1", // localhost
  port: 5432,
  user: "postgres_user",
  password: "postgres_password",
  database: "postgres_db",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// the pool will emit an error on behalf of any idle clients
// it contains if a backend error or network partition happens
pool.on("error", (err, client) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

// const sessionMiddleware = session({
//   store: redisStore,
//   resave: false, // required: force lightweight session keep alive (touch)
//   saveUninitialized: false, // recommended: only save session when data exists
//   secret: "session_secret",
//   // cookie: { maxAge: 86400000, secure: true },
// });

const assetPath = path.join(__dirname, "app");
const staticPath = path.join(__dirname, "static");

const app = express();

// TODO: Create HTTPS server with self-signed certificate
const server = http.createServer(app);

// https://socket.io/docs/v4/redis-adapter/#how-it-works
const redisPubClient = new Redis(redisOpts);
const redisSubClient = redisPubClient.duplicate();

const io = new SocketIOServer(server, {
  adapter: createAdapter(redisPubClient, redisSubClient),
  cors: {
    origin: "*",
  },
  // //socket.io/docs/v3/server-initialization/#allowrequest
  // allowRequest: (req, callback) => {
  //   callback(null, true);
  // },
});

app.set("trust proxy", true);

// security configuration
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

app.get("/favicon.ico", (req, res) => {
  res.sendFile(path.join(staticPath, "favicon.ico"));
});

interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}

type DbRedactUser = Omit<DbUser, "password_hash">;

const redactUserRow = (row: DbUser): DbRedactUser => {
  const { password_hash: _, ...user } = { ...row };
  return user;
};

app.get("/api/v1/users", async (req: Request, res: Response) => {
  const query = "SELECT id, username, created_at FROM users";

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send(ReasonPhrases.INTERNAL_SERVER_ERROR);
    return;
  }
  const users = result.rows.map((row) => redactUserRow(row as DbUser));
  res.json(users);
});

const postUserApiBodySchema = z.object({
  username: z.string().trim().min(3).max(255),
  password: z.string().trim().min(3).max(255),
});

app.post("/api/v1/users", async (req: Request, res: Response) => {
  let safeBody;
  try {
    safeBody = postUserApiBodySchema.parse(req.body);
  } catch (e) {
    throw new BadRequestError({ message: "invalid inputs" });
  }

  const query_check = {
    text: "SELECT CAST(count(id) as INT) as counter FROM users WHERE username = $1",
    values: [safeBody.username],
  };

  let result_check;

  try {
    result_check = await pool.query(query_check);
  } catch (e) {
    // TODO: check for different error types here ...already exsits, and handle differently.  Security best practics for attacks
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send(ReasonPhrases.INTERNAL_SERVER_ERROR);
    return;
  }

  // check if username already exsits
  if (result_check.rowCount !== 1 || result_check.rows[0].counter !== 0) {
    // TODO: decide if this status code makes sense, throw new UserAlreadyExistsError
    return res.status(StatusCodes.SEE_OTHER).json({
      status: StatusCodes.SEE_OTHER,
      message: "Username already exists",
    });
  }

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(safeBody.password, salt);

  // https://node-postgres.com/features/queries#parameterized-query
  const query = {
    text: "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *",
    values: [safeBody.username, hash],
  };

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    console.error(e);
    throw e;
  }

  const user = result.rows[0];
  // create jwt token
  const payload: TokenPayload = {
    userId: user.id,
    username: user.username,
    createdAt: user.created_at,
  };

  const token = jwt.sign(payload, "JWT_SECRET_KEY", {
    // issuer: "",
    // audience: "",
    expiresIn: 24 * 60 * 60, // 1 day
  });

  return res.json({ id: user.id, token });
});

// const getUserApiParamsSchema = z.object({
//   id: z.coerce
//     .number({
//       required_error: "id param is required (2)",
//       message: "id param is not a number",
//     })
//     .int("id param is not an int")
//     .gt(0, "id too small"),
// });

const getUserApiParamsSchema = z.object({
  userId: z.string().uuid(),
});

app.get("/api/v1/users/:userId", async (req: Request, res: Response) => {
  let safeParams;
  try {
    safeParams = getUserApiParamsSchema.parse(req.params);
  } catch (e) {
    throw new BadRequestError({ message: "invalid inputs" });
    // if (e instanceof ZodError) {
    //   // const errorMessages = e.errors.reduce((issue, acc) => {
    //   //   return `${acc} .${issue.path.join(".")} is ${issue.message}`;
    //   // }, "");

    //   return res.status(StatusCodes.BAD_REQUEST).send(`invalid params.`);
    // } else {
    //   return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("oops");
    // }
  }

  const query = {
    text: "SELECT id, username, created_at FROM users WHERE id = $1",
    values: [safeParams.userId],
  };

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    console.error(e);
    throw e;
  }

  if (result?.rowCount === 1) {
    return res.json(result.rows[0]);
  }

  return res.status(StatusCodes.NOT_FOUND).send(ReasonPhrases.NOT_FOUND);
});

app.get("/api/v1/welcome", (req: Request, res: Response) => {
  const socketId = req.query.sid || "";
  if (socketId) {
    // target a single connection
    io.to(socketId as string).emit("chat", "welcome back!!");
  } else {
    // https://socket.io/docs/v4/namespaces/#main-namespace
    // io.sockets, it's simply an alias for io.of("/")
    //
    // emit to everyone
    io.sockets.emit("chat", "welcome welcome welcome");
  }

  res.send("OK");
});

const postLoginApiBodySchema = z.object({
  username: z.string().trim().min(3).max(255),
  password: z.string().trim().min(3).max(255),
});

app.post("/api/v1/login", async (req: Request, res: Response) => {
  let safeBody;
  try {
    safeBody = postLoginApiBodySchema.parse(req.body);
  } catch (e) {
    console.error(req.body, e);
    throw new BadRequestError({ message: "invalid inputs" });
  }

  const query = {
    text: "SELECT id, username, created_at, password_hash FROM users WHERE username = $1",
    values: [safeBody.username],
  };

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    console.error(e);
    throw e;
  }

  if (result?.rowCount === 1) {
    const user = result.rows[0];

    if (bcrypt.compareSync(safeBody.password, user.password_hash)) {
      // create jwt token
      const payload: TokenPayload = {
        userId: user.id,
        username: user.username,
        createdAt: user.created_at,
      };

      const token = jwt.sign(payload, "JWT_SECRET_KEY", {
        // issuer: "",
        // audience: "",
        expiresIn: 24 * 60 * 60, // 1 day
      });

      return res.json({ id: user.id, token });
    }

    // TODO: this is dev friendly, in the wild - we'd want to obfuscate
    return res
      .status(StatusCodes.UNAUTHORIZED)
      .send(ReasonPhrases.UNAUTHORIZED);
  }

  // TODO: this is dev friendly, in the wild - we'd want to obfuscate
  return res.status(StatusCodes.NOT_FOUND).send(ReasonPhrases.NOT_FOUND);
});

const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (
    req?.headers?.authorization &&
    req?.headers?.authorization?.toLowerCase().startsWith("bearer ")
  ) {
    const token = req.headers.authorization.substring(7);

    let payload;
    try {
      payload = jwt.verify(token, "JWT_SECRET_KEY") as TokenPayload;
    } catch (error) {
      // TODO: implement error class here
      return next(new Error("[401] invalid token"));
    }
    // req.session.userId = payload.userId;
    req.payload = payload;
    return next();
  }

  return next(new Error("[401] unauthenticated"));
};

app.get(
  "/api/v1/lists",
  isAuthenticated,
  async (req: Request, res: Response) => {
    const query = {
      text: "SELECT * FROM lists WHERE user_id = $1",
      values: [req.payload.userId],
    };

    let result;
    try {
      result = await pool.query(query);
    } catch (e) {
      console.log(e);
      throw e;
    }

    res.json(result.rows);
  }
);

const postListsApiBodySchema = z.object({
  name: z.string().trim().max(255),
});

app.post(
  "/api/v1/lists",
  isAuthenticated,
  async (req: Request, res: Response) => {
    let safeBody;
    try {
      safeBody = postListsApiBodySchema.parse(req.body);
    } catch (e) {
      throw new BadRequestError({ message: "invalid inputs" });
    }

    const query = {
      text: "INSERT INTO lists (user_id, name) VALUES ($1, $2) RETURNING *",
      values: [req.payload?.userId, safeBody.name],
    };

    let result;
    try {
      result = await pool.query(query);
    } catch (e) {
      console.log(e);
      throw e;
    }

    res.json(result.rows[0]);
  }
);

const getListByIdApiParamSchema = z.object({
  listId: z.string().trim().max(255),
});

app.get(
  "/api/v1/lists/:listId",
  isAuthenticated,
  async (req: Request, res: Response) => {
    let safeParams;
    try {
      safeParams = getListByIdApiParamSchema.parse(req.params);
    } catch (e) {
      throw new BadRequestError({ message: "invalid inputs" });
    }

    const query = {
      text: "SELECT * FROM lists WHERE id = $1",
      values: [safeParams.listId],
    };

    let result;
    try {
      result = await pool.query(query);
    } catch (e) {
      console.log(e);
      throw e;
    }

    if (result?.rowCount === 1) {
      return res.json(result.rows[0]);
    }

    return res.status(StatusCodes.NOT_FOUND).send(ReasonPhrases.NOT_FOUND);
  }
);

const getListRoomKey = (listId: string) => `list:${listId}`;

const postTodosApiBodySchema = z.object({
  listId: z.string().uuid(),
  description: z.string().optional(),
});

app.post(
  "/api/v1/todos",
  isAuthenticated,
  async (req: Request, res: Response) => {
    let safeBody;
    try {
      safeBody = postTodosApiBodySchema.parse(req.body);
    } catch (e) {
      throw new BadRequestError({ message: "invalid inputs" });
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

    const testWorker = true;
    if (testWorker) {
      // doing this approach with ab (apache bench) - shows NO duplicates when queried, so the queue is stable
      // SELECT count(position) as dups FROM todos WHERE list_id='b46f72f7-6bbd-46f8-907f-18f25f58a6be' GROUP BY position HAVING count(position) > 1;

      await processor.addJob(safeBody.listId, uuid(), "create_todo", {
        todoId,
        listId: safeBody.listId,
        userId: req.payload.userId,
        // position: "a1",
        description: safeBody.description,
      });

      // TODO: this doesn't return anything useful right now. Just ques for background processing
      res.send("ok");
    } else {
      // doing this approach with ab (apache bench) - shows duplicates when queried
      // SELECT count(position) as dups FROM todos WHERE list_id='b46f72f7-6bbd-46f8-907f-18f25f58a6be' GROUP BY position HAVING count(position) > 1;

      const lastPosition = await dbTodoNextPosition(safeBody.listId);
      const position = generateKeyBetween(lastPosition, undefined);

      const result = await dbCreateTodo(
        todoId,
        safeBody.listId,
        req.payload.userId,
        position,
        safeBody.description
      );

      io.to(getListRoomKey(safeBody.listId)).emit("create_todo_result", {
        listId: safeBody.listId,
        results: result,
      });

      res.json(result);
    }
  }
);

app.get("/", (req: Request, res: Response) => {
  res.status(200).send("OKIE DOO");
});

app.get("*", (req: Request, res: Response) => res.redirect("/"));

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof CustomError) {
    const { statusCode, errors, logging } = err;
    if (logging) {
      console.error(
        JSON.stringify(
          {
            code: err.statusCode,
            errors: err.errors,
            stack: err.stack,
          },
          null,
          2
        )
      );
    }

    return res.status(statusCode).send({ errors });
  }

  // Unhandled errors
  console.error(JSON.stringify(err, null, 2));
  return res
    .status(500)
    .send({ errors: [{ message: "Something went wrong" }] });
});

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

const dbCreateTodo = async (
  todoId: string,
  listId: string,
  userId: string,
  position: string,
  description: string = "New todo"
) => {
  const query = {
    text: "INSERT INTO todos(id, list_id, created_by, position, description) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    values: [todoId, listId, userId, position, description],
  };

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    console.error(e);
    throw e;
  }

  if (result.rowCount !== 1) {
    // TODO: return an object and let caller handler errror
    throw new Error("failed to create todo");
  }

  return result.rows[0];
};

const dbTodoNextPosition = async (
  listId: string
): Promise<string | undefined> => {
  // NOTE: We need to use COLLATE "POSIX" to get the correct ordering for fractional indexing
  // https://www.postgresql.org/docs/13/collation.html
  // SELECT 'aA' < 'aa' COLLATE "POSIX"; -- true
  const query = {
    text: 'SELECT MAX((position COLLATE "POSIX")) FROM todos WHERE list_id = $1',
    values: [listId],
  };

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    console.error(e);
    throw e;
  }

  if (result.rowCount !== 1) {
    return undefined;
  }

  return result.rows[0].max;
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

  socket.on(
    "create_todo",
    async ({
      listId,
      todoId,
      position,
    }: {
      listId: string;
      todoId: string;
      position: string;
    }) => {
      const { userId } = socket.request.payload;

      await processor.addJob(listId, uuid(), "create_todo", {
        todoId,
        listId,
        userId,
        position,
      });

      // socket.emit("create_todo_result", {
      //   listId,
      //   results: result,
      // });

      // TODO: currently broadcasting to all clients, need to target specific client
      // io.sockets.emit("create_todo_result", { results: result });
      // io.emit("create_todo_result", );
    }
  );

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

  const { todoId, listId, userId, description } = job.data;

  let position = undefined; // job.data.position;
  if (!position) {
    const lastPosition = await dbTodoNextPosition(listId);
    console.log("lastPosition>", lastPosition);
    position = generateKeyBetween(lastPosition, undefined);
    console.log("pos>", lastPosition, position);
  }

  const result = await dbCreateTodo(
    todoId,
    listId,
    userId,
    position,
    description
  );
  console.log("create_todo_result: ", result);

  io.to(getListRoomKey(listId)).emit("create_todo_result", {
    listId,
    results: result,
  });
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
