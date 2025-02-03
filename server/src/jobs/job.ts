import { generateKeyBetween } from "fractional-indexing";
import { createNewTodo, fetchTodosByListId, findTodoNextPosition, updateTodoDescription, updateTodoPosition, updateTodoTransitionStatus } from "../db/queries";
import { getListRoomKey } from "./utils";
import { TODO_STATUS } from "../db/enums";
import { isStatusTransitionValid } from "../rules";
import { Server as SocketIOServer } from "socket.io";
import { JobNames } from "./enums";
import { EventResultNames } from "../ws/enums";

export interface CreateTodoJob {
  todoId: string;
  listId: string;
  userId: string;
  description: string;
}

export const createTodoJob = async (io: SocketIOServer, { todoId, listId, userId, description }: CreateTodoJob) => {
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

  io.to(getListRoomKey(listId)).emit(EventResultNames.CreateTodoResult, {
    listId,
    results: todo,
  });
};

export interface UpdateTodoDescriptionJob {
  todoId: string;
  listId: string;
  description: string;
}

export const updateTodoDescriptionJob = async (io: SocketIOServer, { todoId, listId, description }: UpdateTodoDescriptionJob) => {
  const [error, updatedAt] = await updateTodoDescription(todoId, listId, description);
  if (error) {
    console.error(error);
    return;
  }

  io.to(getListRoomKey(listId)).emit(EventResultNames.UpdateTodoDescriptionResult, {
    listId,
    results: {
      todo_id: todoId,
      description,
      updated_at: updatedAt,
    },
  });
};

export interface TransitionTodoStatusJob {
  todoId: string;
  listId: string;
  fromStatus: TODO_STATUS;
  toStatus: TODO_STATUS;
}

export const transitionTodoStatusJob = async (io: SocketIOServer, { todoId, listId, fromStatus, toStatus }: TransitionTodoStatusJob) => {
  if (!isStatusTransitionValid(fromStatus, toStatus)) {
    console.error(`Invalid status transition from "${fromStatus}" to "${toStatus}" for todo:${todoId}`);
    return;
  }

  const [error, updatedAt] = await updateTodoTransitionStatus(todoId, listId, fromStatus, toStatus);

  if (error) {
    console.error(error);
    return;
  }

  io.to(getListRoomKey(listId)).emit(EventResultNames.TransitionTodoStatusResult, {
    listId,
    results: {
      todo_id: todoId,
      status: toStatus,
      updated_at: updatedAt,
    },
  });
};

export interface MoveTodoJob {
  todoId: string;
  listId: string;
  position: string;
}

export const moveTodoJob = async (io: SocketIOServer, { todoId, listId, position }: MoveTodoJob) => {
  const [error, updatedAt] = await updateTodoPosition(todoId, listId, position);

  if (error) {
    console.error(error);
    return;
  }

  io.to(getListRoomKey(listId)).emit(EventResultNames.MoveTodoResult, {
    listId,
    results: {
      todo_id: todoId,
      position,
      updated_at: updatedAt,
    },
  });
};

export interface FetchTodosJob {
  listId: string;
  socketId: string;
}

export const fetchTodosJob = async (io: SocketIOServer, { listId, socketId }: FetchTodosJob) => {
  const [error, todos] = await fetchTodosByListId(listId);
  if (error) {
    console.error(error);
    return;
  }

  io.to(socketId).emit(EventResultNames.FetchTodosResult, {
    listId,
    results: todos,
  });
};

export const handleJobFactory = (io: SocketIOServer) => async (job: any) => {
  switch (job.name) {
    case JobNames.FetchTodos:
      fetchTodosJob(io, job.data);
      break;
    case JobNames.CreateTodo:
      createTodoJob(io, job.data);
      break;
    case JobNames.UpdateTodoDescription:
      updateTodoDescriptionJob(io, job.data);
      break;
    case JobNames.TransitionTodoStatus:
      transitionTodoStatusJob(io, job.data);
      break;
    case JobNames.MoveTodo:
      moveTodoJob(io, job.data);
      break;
    default:
      console.error("unknown job name: ", job.name);
      break;
  }
};
