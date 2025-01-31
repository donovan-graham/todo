export enum TODO_POSITION_DIRECTION {
  Up = 'up',
  Down = 'down'
}

export enum TODO_STATUS {
  Todo = 'todo',
  OnGoing = 'ongoing',
  Done = 'done'
}

export const TODO_STATUS_COLORS: {
  [keys in TODO_STATUS]: string
} = {
  [TODO_STATUS.Todo]: '#f9aa4c',
  [TODO_STATUS.OnGoing]: '#64b4ff',
  [TODO_STATUS.Done]: '#b2d199'
}

export const TODO_STATUS_TRANSITION: {
  [keys in TODO_STATUS]: [TODO_STATUS | undefined, TODO_STATUS | undefined]
} = {
  [TODO_STATUS.Todo]: [undefined, TODO_STATUS.OnGoing],
  [TODO_STATUS.OnGoing]: [TODO_STATUS.Todo, TODO_STATUS.Done],
  [TODO_STATUS.Done]: [TODO_STATUS.OnGoing, undefined]
}

export interface Todo {
  id: string
  list_id: string
  position: string
  description: string
  status: TODO_STATUS
  created_at: string
  created_by: string
  updated_at: string
}
