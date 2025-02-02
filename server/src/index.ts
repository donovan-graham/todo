import express, { Request, Response } from "express";
import path from "path";
import helmet from "helmet";
import { Redis, RedisOptions } from "ioredis";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import http from "http";
import bodyParser from "body-parser";
import "express-async-errors";
import { pool } from "./db/connection";
import { requestLogger, errorHandler } from "./logging/logger";
import { TokenPayload } from "./types";
import { createRouter as createRootRouter } from "./routes";
import { JobProcessor } from "./jobs/processor";
import { mountSocketEvents } from "./ws";

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

const server = http.createServer(app);

const redisPubClient = new Redis(redisOpts);
const redisSubClient = redisPubClient.duplicate();

const io = new SocketIOServer(server, {
  adapter: createAdapter(redisPubClient, redisSubClient),
  cors: { origin: "*" },
});

const redisConnection = new Redis({ ...redisOpts, maxRetriesPerRequest: null });

const jobProcessor = new JobProcessor(redisConnection, io);

mountSocketEvents(io, jobProcessor);

app.set("trust proxy", true);
app.use(helmet());

// parse json body
app.use(bodyParser.json());

// static assets
app.use("/v1/assets", express.static(assetPath));
app.use("/v1/static", express.static(staticPath));
app.get("/favicon.ico", (_, res) => res.sendFile(path.join(staticPath, "favicon.ico")));

// start logging after static assets
app.use(requestLogger);

// app router
app.use(createRootRouter(jobProcessor));

// catch all handlers
app.get("/", (req: Request, res: Response) => {
  res.status(200).send("OK");
});

app.get("*", (_: Request, res: Response) => res.redirect("/"));

app.use(errorHandler);

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
