import { Server as SocketIOServer } from "socket.io";
import { Pool } from "pg";

import { fetchTodosJob, createTodoJob, updateTodoDescriptionJob, transitionTodoStatusJob, moveTodoJob } from "./job";
import { DBError } from "../errors/errors";
import { TODO_STATUS } from "../db/enums";

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

describe("jobs", () => {
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

  test("updateTodoDescriptionJob", async () => {
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

  test("updateTodoDescriptionJob - error", async () => {
    (pool.query as jest.Mock).mockRejectedValueOnce(new Error("test error"));
    await updateTodoDescriptionJob(io, { todoId: "todo-id", listId: "list-id", description: "new desc" });
    expect(console.error).toHaveBeenCalledWith(new Error("test error"));
  });

  test("createTodoJob", async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ max: "aa" }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "todo-id",
            list_id: "list-id",
            position: "aA",
            created_at: "2025-01-27 22:32:22.914",
            status: "todo",
            updated_at: "2025-01-27 22:32:22.914",
            created_by: "user-id",
            description: "new desc",
          },
        ],
      });

    await createTodoJob(io, { todoId: "todo-id", listId: "list-id", userId: "user-id", description: "new desc" });

    expect((io.to as jest.Mock).mock.calls[0][0]).toBe("list:list-id");
    expect((io.use as jest.Mock).mock.calls[0][0]).toBe("create_todo_result");
    expect((io.use as jest.Mock).mock.calls[0][1]).toEqual({
      listId: "list-id",
      results: {
        id: "todo-id",
        list_id: "list-id",
        position: "aA",
        created_at: "2025-01-27 22:32:22.914",
        status: "todo",
        updated_at: "2025-01-27 22:32:22.914",
        created_by: "user-id",
        description: "new desc",
      },
    });
  });

  test("moveTodoJob", async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ updated_at: "2025-01-27 24:32:22.914" }],
    });

    await moveTodoJob(io, { todoId: "todo-id", listId: "list-id", position: "aA" });

    expect((io.to as jest.Mock).mock.calls[0][0]).toBe("list:list-id");
    expect((io.use as jest.Mock).mock.calls[0][0]).toBe("move_todo_result");
    expect((io.use as jest.Mock).mock.calls[0][1]).toEqual({
      listId: "list-id",
      results: {
        position: "aA",
        todo_id: "todo-id",
        updated_at: "2025-01-27 24:32:22.914",
      },
    });
  });

  test("transitionTodoStatusJob - todo > ongoing", async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ updated_at: "2025-01-27 22:32:22.914" }],
    });

    await transitionTodoStatusJob(io, { todoId: "todo-id", listId: "list-id", fromStatus: TODO_STATUS.Todo, toStatus: TODO_STATUS.OnGoing });

    expect((io.to as jest.Mock).mock.calls[0][0]).toBe("list:list-id");
    expect((io.use as jest.Mock).mock.calls[0][0]).toBe("transition_todo_status_result");
    expect((io.use as jest.Mock).mock.calls[0][1]).toEqual({
      listId: "list-id",
      results: {
        todo_id: "todo-id",
        status: "ongoing",
        updated_at: "2025-01-27 22:32:22.914",
      },
    });
  });

  test("transitionTodoStatusJob - ongoing > done", async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ updated_at: "2025-01-27 22:32:22.914" }],
    });

    await transitionTodoStatusJob(io, { todoId: "todo-id", listId: "list-id", fromStatus: TODO_STATUS.OnGoing, toStatus: TODO_STATUS.Done });

    expect((io.to as jest.Mock).mock.calls[0][0]).toBe("list:list-id");
    expect((io.use as jest.Mock).mock.calls[0][0]).toBe("transition_todo_status_result");
    expect((io.use as jest.Mock).mock.calls[0][1]).toEqual({
      listId: "list-id",
      results: {
        todo_id: "todo-id",
        status: "done",
        updated_at: "2025-01-27 22:32:22.914",
      },
    });
  });

  test("transitionTodoStatusJob - done > ongoing", async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ updated_at: "2025-01-27 22:32:22.914" }],
    });

    await transitionTodoStatusJob(io, { todoId: "todo-id", listId: "list-id", fromStatus: TODO_STATUS.Done, toStatus: TODO_STATUS.OnGoing });

    expect((io.to as jest.Mock).mock.calls[0][0]).toBe("list:list-id");
    expect((io.use as jest.Mock).mock.calls[0][0]).toBe("transition_todo_status_result");
    expect((io.use as jest.Mock).mock.calls[0][1]).toEqual({
      listId: "list-id",
      results: {
        todo_id: "todo-id",
        status: "ongoing",
        updated_at: "2025-01-27 22:32:22.914",
      },
    });
  });

  test("transitionTodoStatusJob - ongoing > todo", async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ updated_at: "2025-01-27 22:32:22.914" }],
    });

    await transitionTodoStatusJob(io, { todoId: "todo-id", listId: "list-id", fromStatus: TODO_STATUS.OnGoing, toStatus: TODO_STATUS.Todo });

    expect((io.to as jest.Mock).mock.calls[0][0]).toBe("list:list-id");
    expect((io.use as jest.Mock).mock.calls[0][0]).toBe("transition_todo_status_result");
    expect((io.use as jest.Mock).mock.calls[0][1]).toEqual({
      listId: "list-id",
      results: {
        todo_id: "todo-id",
        status: "todo",
        updated_at: "2025-01-27 22:32:22.914",
      },
    });
  });

  test("transitionTodoStatusJob - todo > done == Error", async () => {
    await transitionTodoStatusJob(io, { todoId: "todo-id", listId: "list-id", fromStatus: TODO_STATUS.Todo, toStatus: TODO_STATUS.Done });
    expect(console.error).toHaveBeenCalledWith('Invalid status transition from "todo" to "done" for todo:todo-id');
  });

  test("transitionTodoStatusJob - done > todo == Error", async () => {
    await transitionTodoStatusJob(io, { todoId: "todo-id", listId: "list-id", fromStatus: TODO_STATUS.Done, toStatus: TODO_STATUS.Todo });
    expect(console.error).toHaveBeenCalledWith('Invalid status transition from "done" to "todo" for todo:todo-id');
  });
});
