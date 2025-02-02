import "express-async-errors";
import express from "express";
import router from "./auth";
import bodyParser from "body-parser";
import request from "supertest";
import { errorHandler } from "../logging/logger";
import jwt from "jsonwebtoken";
import { Pool } from "pg";

jest.mock("pg", () => {
  const mPool = {
    connect: function () {
      return { query: jest.fn() };
    },
    query: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

const app = express();
app.use(bodyParser.json());
app.use(router);
app.use(errorHandler);

describe("/api/v1/login", () => {
  let pool: Pool;

  beforeEach(() => {
    pool = new Pool();
    jest.spyOn(console, "error").mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("invalid body - responds with 400 status code", async () => {
    const response = await request(app).post("/api/v1/login").send({});
    expect(response.status).toEqual(400);
  });

  test("unknown user - responds with 400 status code", async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    });
    const response = await request(app).post("/api/v1/login").send({ username: "unknown", password: "pass" });

    expect(response.status).toEqual(400);
  });

  test("valid user with invalid passowrd - responds with 401 status code", async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: "52177dc0-1a37-426c-b5e1-e9f54e6604a4",
          username: "don",
          password_hash: "$2b$10$KCrkheNvz9WyiS8iezwo8OK5oZxcC/FMP/T8UKuWLVTz/jMWqZ4tq",
          created_at: "2025-01-27 22:32:22.914",
        },
      ],
    });
    const response = await request(app).post("/api/v1/login").send({ username: "don", password: "invalid" });

    expect(response.status).toEqual(401);
  });

  test("valid user and password - responds with 200 status code and auth token payload", async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: "52177dc0-1a37-426c-b5e1-e9f54e6604a4",
          username: "don",
          password_hash: "$2b$10$KCrkheNvz9WyiS8iezwo8OK5oZxcC/FMP/T8UKuWLVTz/jMWqZ4tq",
          created_at: "2025-01-27 22:32:22.914",
        },
      ],
    });
    const response = await request(app).post("/api/v1/login").send({ username: "don", password: "pass" });

    expect(response.status).toEqual(200);
    expect(response.body.id).toEqual("52177dc0-1a37-426c-b5e1-e9f54e6604a4");

    const jwyPayload = jwt.decode(response.body.token, { json: true, complete: false });
    expect(jwyPayload).toEqual(
      expect.objectContaining({
        userId: "52177dc0-1a37-426c-b5e1-e9f54e6604a4",
        username: "don",
        createdAt: "2025-01-27 22:32:22.914",
      })
    );
  });
});

describe("/api/v1/register", () => {
  let pool: Pool;

  beforeEach(() => {
    pool = new Pool();
    jest.spyOn(console, "error").mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("invalid body - responds with 400 status code", async () => {
    const response = await request(app).post("/api/v1/register").send({});
    expect(response.status).toEqual(400);
  });

  test("user already exists - responds with 303 status code", async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: "52177dc0-1a37-426c-b5e1-e9f54e6604a4",
          username: "don",
          password_hash: "$2b$10$KCrkheNvz9WyiS8iezwo8OK5oZxcC/FMP/T8UKuWLVTz/jMWqZ4tq",
          created_at: "2025-01-27 22:32:22.914",
        },
      ],
    });
    const response = await request(app).post("/api/v1/register").send({ username: "don", password: "pass" });
    expect(response.status).toEqual(303);
  });

  test("user - responds with 201 status code and auth token payload", async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "52177dc0-1a37-426c-b5e1-e9f54e6604a4",
            username: "don",
            password_hash: "$2b$10$KCrkheNvz9WyiS8iezwo8OK5oZxcC/FMP/T8UKuWLVTz/jMWqZ4tq",
            created_at: "2025-01-27 22:32:22.914",
          },
        ],
      });
    const response = await request(app).post("/api/v1/register").send({ username: "don", password: "pass" });

    expect(response.status).toEqual(201);
    expect(response.body.id).toEqual("52177dc0-1a37-426c-b5e1-e9f54e6604a4");

    const jwyPayload = jwt.decode(response.body.token, { json: true, complete: false });
    expect(jwyPayload).toEqual(
      expect.objectContaining({
        userId: "52177dc0-1a37-426c-b5e1-e9f54e6604a4",
        username: "don",
        createdAt: "2025-01-27 22:32:22.914",
      })
    );
  });
});
