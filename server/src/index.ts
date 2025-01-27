import express, { NextFunction, Request, Response } from "express";
import path from "path";
// import helmet from "helmet";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";

import { ReasonPhrases, StatusCodes } from "http-status-codes";
import session from "express-session";
import Redis from "ioredis";
import { RedisStore } from "connect-redis";
import http from "http";
import pg from "pg";
import jwt from "jsonwebtoken";

import { z, ZodError } from "zod";
import "express-async-errors";
import bcrypt from "bcrypt";
import { v4 as uuid } from "uuid";

interface TokenPayload {
  userId: string;
  username: string;
  createdAt: string;
}

interface UserSessionData {
  views: number;
  userId?: string;
}
// https://socket.io/how-to/use-with-express-session#with-typescript
declare module "express-session" {
  interface SessionData extends UserSessionData {}
}

declare module "node:http" {
  interface IncomingMessage {
    session: UserSessionData;
    payload?: TokenPayload;
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

// https://socket.io/docs/v4/redis-adapter/#how-it-works
const redisPublishClient = new Redis({
  port: 6379,
  host: "127.0.0.1", // localhost
  username: "default",
  password: "redis_password",
});

const redisSubscribeClient = redisPublishClient.duplicate();

const redisStore = new RedisStore({
  client: redisPublishClient,
  prefix: "poolside:",
});

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

const sessionMiddleware = session({
  store: redisStore,
  resave: false, // required: force lightweight session keep alive (touch)
  saveUninitialized: false, // recommended: only save session when data exists
  secret: "session_secret",
  // cookie: { maxAge: 86400000, secure: true },
});

const assetPath = path.join(__dirname, "app");
const staticPath = path.join(__dirname, "static");

const app = express();

// TODO: Create HTTPS server with self-signed certificate
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  adapter: createAdapter(redisPublishClient, redisSubscribeClient),
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
// app.use(helmet());

// Initialize session storage.
app.use(sessionMiddleware);

// parse json body
app.use(express.json());

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

  res.json(result.rows[0]);

  // https://node-postgres.com/features/transactions
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
  user_id: z.string().uuid(),
});

app.get("/api/v1/users/:user_id", async (req: Request, res: Response) => {
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
    values: [safeParams.user_id],
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
    io.in(socketId as string).emit("chat", "welcome back!!");
  } else {
    // emit to everyone
    io.sockets.emit("chat", "welcome welcome welcome");
    // is equivalent to
    // io.of("/").emit("hi", "everyone");
  }

  res.send("OK");
});

// delete room endpoint
// make all Socket instances leave the "room1" room
// https://socket.io/docs/v4/server-api/#serversocketsleaverooms
// io.socketsLeave("room1");

// https://socket.io/docs/v4/server-api/#serverinroom
// disconnect all clients in the "room-101" room
// io.in("room-101").disconnectSockets();

const postLoginApiBodySchema = z.object({
  username: z.string().trim().min(3).max(255),
  password: z.string().trim().min(3).max(255),
});

app.post("/api/v1/login", async (req: Request, res: Response) => {
  let safeBody;
  try {
    safeBody = postLoginApiBodySchema.parse(req.body);
  } catch (e) {
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
      // save user in session
      req.session.userId = user.id;

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

// My lists

const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  // check session
  if (req.session?.userId) {
    return next();
  }

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
    req.session.userId = payload.userId;
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
      values: [req.session.userId],
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
      values: [req.session.userId, safeBody.name],
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

app.get("/", (req: Request, res: Response) => {
  if (req.session.views) {
    req.session.views++;
  } else {
    req.session.views = 1;
  }

  res.status(200).send("OKIE DOO");
});

app.get("*", (req: Request, res: Response) => res.redirect("/"));

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Handled errors
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
}); // <--------- using the errorHandler

// declare module "socket.io" {
//   interface Socket {
//     session: Session;
//   }
// }

// declare module "socket.io" {
//   interface Socket {
//     request: SessionIncomingMessage;
//   }
// }

io.engine.use(sessionMiddleware);

// io.engine.use(async (req, res, next) => {
//   return next(new Error("invalid token"));
// });

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
    // TODO: implement error class here
    return next(new Error("[401] invalid token"));
  }

  socket.request.payload = payload;
  return next();
});

// io.use((socket, next) => {
//   if (isValid(socket.request)) {
//     next();
//   } else {
//     next(new Error("invalid"));
//   }
// });

// io.engine.use((req, res, next) => {
//   const isHandshake = req._query.sid === undefined;
//   if (!isHandshake) {
//     return next();
//   }

//   const header = req.headers["authorization"];

//   if (!header) {
//     return next(new Error("no token"));
//   }

//   if (!header.startsWith("bearer ")) {
//     return next(new Error("invalid token"));
//   }

//   const token = header.substring(7); // string "baearer "

//   let payload;
//   try {
//     payload = jwt.verify(token, "JWT_SECRET_KEY");
//   } catch (error) {
//     console.log(error);
//   }

//   if (!payload) {
//     return next(new Error("invalid token"));
//   }
//   req.user = payload;
//   next();
// });

io.on("connection", (socket) => {
  console.log(socket.handshake.auth); // prints { token: "abcd" }

  console.log("a user connected");

  socket.on("chat", (msg) => {
    const payload = socket.request.payload;

    console.log("chat message: ", msg, payload?.user);
    io.emit("chat", `Server received: ${msg} ${payload?.user}`);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

//
// Start the server.
//
server.listen(3000, function () {
  console.log("Listening on http://localhost:3000");
});

process.on("SIGINT", async () => {
  console.log("Received SIGINT. Closing server...");
  await pool.end();
  await server.close();
  process.exit(0);
});

/// https://socketio.p2hp.com/how-to/use-with-express-session/
