import { Server as SocketIOServer } from "socket.io";
import { TokenPayload } from "../types";
import { getListRoomKey } from "../jobs/utils";
import jwt from "jsonwebtoken";
import { JobProcessor } from "../jobs/processor";
import { v4 as uuid } from "uuid";
import { TODO_STATUS } from "../db/enums";
import { JobNames } from "../jobs/enums";
import { EventNames } from "./enums";

export const mountSocketEvents = (io: SocketIOServer, jobProcessor: JobProcessor) => {
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
    // console.log("user connection");
    const roomKey = getListRoomKey(socket.handshake.auth.listId);
    socket.join(roomKey);

    socket.on(EventNames.FetchTodos, async ({ listId }: { listId: string }) => {
      await jobProcessor.addJob(listId, uuid(), JobNames.FetchTodos, {
        listId,
        socketId: socket.id,
      });
    });

    socket.on(EventNames.CreateTodo, async ({ listId, todoId, position }: { listId: string; todoId: string; position: string }) => {
      const { userId } = socket.request.payload;
      await jobProcessor.addJob(listId, uuid(), JobNames.CreateTodo, {
        todoId,
        listId,
        userId,
        position,
      });
    });

    socket.on(EventNames.UpdateTodoDescription, async ({ listId, todoId, description }: { listId: string; todoId: string; description: string }) => {
      await jobProcessor.addJob(listId, uuid(), JobNames.UpdateTodoDescription, {
        todoId,
        listId,
        description,
      });
    });

    socket.on(
      EventNames.TransitionTodoStatus,
      async ({ listId, todoId, fromStatus, toStatus }: { listId: string; todoId: string; fromStatus: TODO_STATUS; toStatus: TODO_STATUS }) => {
        await jobProcessor.addJob(listId, uuid(), JobNames.TransitionTodoStatus, {
          todoId,
          listId,
          fromStatus,
          toStatus,
        });
      }
    );

    socket.on(EventNames.MoveTodo, async ({ listId, todoId, position }: { listId: string; todoId: string; position: string }) => {
      await jobProcessor.addJob(listId, uuid(), JobNames.MoveTodo, {
        todoId,
        listId,
        position,
      });
    });

    socket.on("disconnect", () => {
      // console.log("user disconnected");
    });
  });
};
