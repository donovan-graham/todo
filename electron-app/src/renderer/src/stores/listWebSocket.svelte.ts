import { io, Socket } from 'socket.io-client'
import { v4 as uuid } from 'uuid'
import { generateKeyBetween } from 'fractional-indexing'

import { TODO_STATUS, TODO_POSITION_DIRECTION } from '../utils'
import type { Todo } from '../utils'

export const posixCompare = (a: string, b: string): number => {
  if (a < b) {
    return -1
  }
  if (a > b) {
    return 1
  }
  return 0
}

export class ListWebSocket {
  #socket: Socket | null = null
  port: number = 3000

  listId = $state('')
  lastTodoId = $state('')
  #todos = $state<Todo[]>([])

  sortedTodos = $derived.by(() => {
    return [...this.#todos].sort((a, b) => posixCompare(a.position, b.position))
  })
  count = $derived(this.#todos.length)

  isConnected = $state(false)
  isFetching = $state(false)

  constructor(port = 3000) {
    this.port = port
  }

  connect = (token: string, listId: string) => {
    this.listId = listId

    this.#socket = io(`ws://localhost:${this.port}`, {
      transports: ['websocket'],
      auth: {
        token: token,
        listId: listId
      }
    })

    this.#socket.on('ping', () => {
      console.log('Socket.io = Ping received from server')
    })

    this.#socket.on('connect', () => {
      console.log('Socket.io = Connected to server')
      this.isConnected = true
      this.fetchList()
    })

    this.#socket.on('fetch_list_result', (data) => {
      if (data.listId !== this.listId) {
        return
      }
      this.#todos = data.results as Todo[]
      this.isFetching = false
    })

    this.#socket.on('create_todo_result', (data) => {
      if (data.listId !== this.listId) {
        return
      }
      this.#todos.push(data.results as Todo)
    })

    this.#socket.on('update_todo_description_result', (data) => {
      if (data.listId !== this.listId) {
        return
      }

      const todo = this.#todos.find((todo) => todo.id === data.results.todo_id)
      if (todo) {
        todo.description = data.results.description
        todo.updated_at = data.results.updated_at
      }
    })

    this.#socket.on('transition_todo_status_result', (data) => {
      if (data.listId !== this.listId) {
        return
      }

      const todo = this.#todos.find((todo) => todo.id === data.results.todo_id)
      if (todo) {
        todo.status = data.results.status as TODO_STATUS
        todo.updated_at = data.results.updated_at
      }
    })
    this.#socket.on('move_todo_result', (data) => {
      if (data.listId !== this.listId) {
        return
      }

      const todo = this.#todos.find((todo) => todo.id === data.results.todo_id)
      if (todo) {
        todo.position = data.results.position
        todo.updated_at = data.results.updated_at
      }
    })

    this.#socket.on('connect_error', (error) => {
      console.log(`Socket.io = Error connecting to server: ${error}`)
    })

    this.#socket.on('reconnect', (attempt) => {
      console.log(`Socket.io = Reconnected to server after ${attempt} attempts`)
    })

    this.#socket.on('disconnect', (reason) => {
      if (this.#socket?.active) {
        console.log('Socket.io = Temporary disconnection')
      } else {
        this.isConnected = false
        console.log(`Socket.io = Permanent disconnection ${reason}`)
      }
    })

    this.#socket.on('message', (error) => {
      console.log(`Socket.io = Error: ${error.message}`)
    })

    this.#socket.on('error', (error) => {
      console.log(`Socket.io = Error: ${error.message}`)
    })

    this.#socket.on('chat', (msg) => {
      console.log(`Socket.io = Chat message from server: ${msg}`)
    })
  }

  createTodo = () => {
    const todoId = uuid()
    this.lastTodoId = todoId

    const lastPos = this.sortedTodos[this.sortedTodos.length - 1]?.position
    const position = generateKeyBetween(lastPos, undefined)

    const payload = {
      listId: this.listId,
      todoId,
      position
    }
    this.#socket?.emit('create_todo', payload)
  }

  updateTodoDescription = (todoId: string, description: string) => {
    const payload = {
      listId: this.listId,
      todoId,
      description
    }
    this.#socket?.emit('update_todo_description', payload)
  }

  moveTodo = (todoId: string, direction: TODO_POSITION_DIRECTION) => {
    this.lastTodoId = todoId

    const todoIndex = this.sortedTodos.findIndex((todo) => todo.id === todoId)
    if (todoIndex === -1) {
      return
    }

    let startPos: string
    let endPos: string

    if (direction === TODO_POSITION_DIRECTION.Up) {
      startPos = this.sortedTodos[todoIndex - 2]?.position
      endPos = this.sortedTodos[todoIndex - 1]?.position
    } else {
      startPos = this.sortedTodos[todoIndex + 1]?.position
      endPos = this.sortedTodos[todoIndex + 2]?.position
    }

    if (startPos === undefined && endPos === undefined) {
      return
    }

    const position = generateKeyBetween(startPos, endPos)
    if (!position) {
      return
    }

    const payload = {
      listId: this.listId,
      todoId,
      position
    }
    this.#socket?.emit('move_todo', payload)
  }

  transitionTodoStatus = (todoId: string, fromStatus: TODO_STATUS, toStatus: TODO_STATUS) => {
    this.lastTodoId = todoId

    const payload = {
      listId: this.listId,
      todoId,
      fromStatus,
      toStatus
    }
    this.#socket?.emit('transition_todo_status', payload)
  }

  fetchList = () => {
    this.isFetching = true
    this.#socket?.emit('fetch_list', { listId: this.listId })
  }

  disconnect = () => {
    this.#socket?.disconnect()
    this.#socket = null
  }
}
