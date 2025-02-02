import { TODO_STATUS } from "./db/enums";

export const isStatusTransitionValid = (fromStatus: TODO_STATUS, toStatus: TODO_STATUS): boolean => {
  if (fromStatus === TODO_STATUS.Todo && toStatus === TODO_STATUS.OnGoing) {
    return true;
  }

  if (fromStatus === TODO_STATUS.OnGoing && (toStatus === TODO_STATUS.Todo || toStatus === TODO_STATUS.Done)) {
    return true;
  }

  if (fromStatus === TODO_STATUS.Done && toStatus === TODO_STATUS.OnGoing) {
    return true;
  }

  return false;
};
