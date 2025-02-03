import { Server as SocketIOServer } from "socket.io";
import { Pool } from "pg";

import { updateTodoDescriptionJob } from "./job";

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

jest.mock("socket.io", () => {
  const on = jest.fn();
  const emit = jest.fn();
  const emitTo = jest.fn();
  const to = jest.fn(() => {
    return { emit: emitTo };
  });

  const mSocket = {
    on,
    emit,
    to,
    // Note: we're hijacking the use method to store the callback
    use: emitTo,
  };
  return { Server: jest.fn(() => mSocket) };
});

describe("updateTodoDescriptionJob", () => {
  let pool: Pool;
  let io: SocketIOServer;
  beforeEach(() => {
    pool = new Pool();
    io = new SocketIOServer();

    jest.spyOn(console, "error").mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("completed", async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ updated_at: "2025-01-27 22:32:22.914" }],
    });

    await updateTodoDescriptionJob(io, { todoId: "todo-id", listId: "list-id", description: "new desc" });

    expect((io.to as jest.Mock).mock.calls[0][0]).toBe("list:list-id");
    expect((io.use as jest.Mock).mock.calls[0][0]).toBe("update_todo_description_result");
    expect((io.use as jest.Mock).mock.calls[0][1]).toEqual({
      listId: "list-id",
      results: {
        description: "new desc",
        todo_id: "todo-id",
        updated_at: "2025-01-27 22:32:22.914",
      },
    });
  });
});
