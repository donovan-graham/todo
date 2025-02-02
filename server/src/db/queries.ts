import { DBError, DBNotFoundError, UserNotFoundError } from "../errors/errors";
import { pool } from "./connection";
import { TODO_STATUS } from "./enums";

export interface DbUserWithPassowrd {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}

export type DbRedactUser = Omit<DbUserWithPassowrd, "password_hash">;

export type DbResult<T> = Promise<[Error, null] | [null, T]>;

export const redactUserRow = (row: DbUserWithPassowrd): DbRedactUser => {
  const { password_hash: _, ...user } = { ...row };
  return user;
};

export const fetchAllUsers = async (): DbResult<DbRedactUser[]> => {
  const query = "SELECT id, username, created_at FROM users";

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    return [e as Error, null];
  }

  return [null, result.rows];
};

export const fetchUserById = async (id: string): DbResult<DbRedactUser> => {
  const query = {
    text: "SELECT id, username, created_at FROM users WHERE id = $1",
    values: [id],
  };

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    return [e as Error, null];
  }

  if (result?.rowCount !== 1) {
    return [new UserNotFoundError("User not found"), null];
  }

  return [null, redactUserRow(result.rows[0])];
};

export const fetchUserByUsername = async (username: string): DbResult<DbUserWithPassowrd> => {
  const query = {
    text: "SELECT id, username, created_at, password_hash FROM users WHERE username = $1",
    values: [username],
  };

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    return [e as Error, null];
  }

  if (result?.rowCount !== 1) {
    return [new UserNotFoundError("User not found"), null];
  }

  return [null, result.rows[0]];
};

export const createNewUser = async (username: string, password_hash: string): DbResult<DbRedactUser> => {
  const query = {
    text: "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *",
    values: [username, password_hash],
  };

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    return [e as Error, null];
  }

  if (result?.rowCount !== 1) {
    return [new DBError("Unable to create new user"), null];
  }

  return [null, redactUserRow(result.rows[0])];
};

export interface DbList {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export const fetchListsByUserId = async (userId: string): DbResult<DbList[]> => {
  const query = {
    text: "SELECT * FROM lists WHERE user_id = $1",
    values: [userId],
  };

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    return [e as Error, null];
  }

  return [null, result.rows];
};

export const createNewList = async (userId: string, name: string): DbResult<DbList> => {
  const query = {
    text: "INSERT INTO lists (user_id, name) VALUES ($1, $2) RETURNING *",
    values: [userId, name],
  };

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    return [e as Error, null];
  }

  if (result?.rowCount !== 1) {
    return [new DBError("Unable to create new list"), null];
  }

  return [null, result.rows[0]];
};

export const fetchListById = async (listId: string): DbResult<DbList> => {
  const query = {
    text: "SELECT * FROM lists WHERE list_id = $1",
    values: [listId],
  };

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    return [e as Error, null];
  }

  if (result?.rowCount !== 1) {
    return [new DBNotFoundError(`Unable to find list by id ${listId}`), null];
  }

  return [null, result.rows[0]];
};

export interface DbTodo {
  id: string;
  list_id: string;
  created_by: string;
  position: string;
  description: string;
  status: TODO_STATUS;
  created_at: string;
  updated_at: string;
}

export const fetchTodosByListId = async (listId: string): DbResult<DbTodo[]> => {
  const query = {
    text: "SELECT * FROM todos WHERE list_id = $1",
    values: [listId],
  };

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    return [e as Error, null];
  }

  return [null, result.rows];
};

export const createNewTodo = async (todoId: string, listId: string, userId: string, position: string, description: string = "New todo"): DbResult<DbTodo> => {
  const query = {
    text: "INSERT INTO todos(id, list_id, created_by, position, description) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    values: [todoId, listId, userId, position, description],
  };

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    return [e as Error, null];
  }

  if (result.rowCount !== 1) {
    return [new DBError("Unable to create new todo"), null];
  }

  return [null, result.rows[0]];
};

export const findTodoNextPosition = async (listId: string): DbResult<string | undefined> => {
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
    return [e as Error, null];
  }

  if (result.rowCount !== 1) {
    return [null, undefined];
  }

  return [null, result.rows[0].max];
};

export const updateTodoDescription = async (todoId: string, listId: string, description: string): DbResult<string> => {
  const query = {
    text: "UPDATE todos SET description = $1, updated_at = DEFAULT WHERE id = $2 AND list_id = $3 RETURNING updated_at",
    values: [description, todoId, listId],
  };

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    return [e as Error, null];
  }

  if (result?.rowCount !== 1) {
    return [new DBNotFoundError(`Unable to update todo ${todoId} description`), null];
  }

  return [null, result.rows[0].updated_at];
};

export const updateTodoTransitionStatus = async (todoId: string, listId: string, fromStatus: TODO_STATUS, toStatus: TODO_STATUS): DbResult<string> => {
  const query = {
    text: "UPDATE todos SET status = $1, updated_at = DEFAULT WHERE id = $2 AND list_id = $3 AND status = $4 RETURNING updated_at",
    values: [toStatus, todoId, listId, fromStatus],
  };

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    return [e as Error, null];
  }

  if (result?.rowCount !== 1) {
    return [new DBNotFoundError(`Unable to update todo ${todoId} status from ${fromStatus} to ${toStatus}`), null];
  }

  return [null, result.rows[0].updated_at];
};

export const updateTodoPosition = async (todoId: string, listId: string, position: string): DbResult<string> => {
  const query = {
    text: "UPDATE todos SET position = $1, updated_at = DEFAULT WHERE id = $2 AND list_id = $3 RETURNING updated_at",
    values: [position, todoId, listId],
  };

  let result;
  try {
    result = await pool.query(query);
  } catch (e) {
    return [e as Error, null];
  }

  if (result?.rowCount !== 1) {
    return [new DBNotFoundError(`Unable to update todo ${todoId} position`), null];
  }

  return [null, result.rows[0].updated_at];
};
