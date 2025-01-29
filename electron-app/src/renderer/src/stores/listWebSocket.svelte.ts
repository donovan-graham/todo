import { io, Socket } from 'socket.io-client'
import { v4 as uuid } from 'uuid'
import { generateKeyBetween } from 'fractional-indexing'
export const positionCompare = (a: string, b: string): number => {
  if (a < b) {
    return -1
  }
  if (a > b) {
    return 1
  }
  return 0
}

interface Todo {
  id: string
  list_id: string
  position: string
  description: string
  status: number
  created_at: string
  created_by: string
  updated_at: string
}

export class ListWebSocket {
  #socket: Socket | null = null

  listId = $state('')
  todos = $state<Todo[]>([])

  listPosition = $derived.by(() => {
    return this.todos.map((todo: any) => todo.position).sort(positionCompare)
  })

  isConnected = $state(false)
  isFetching = $state(false)

  constructor() {}

  connect = (token: string, listId: string) => {
    this.listId = listId

    this.#socket = io('ws://localhost:3000', {
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
      // if (data.listId !== this.listId) {
      //   return
      // }
      this.todos = data.results as Todo[]
      this.isFetching = false
    })

    this.#socket.on('create_todo_result', (data) => {
      // if (data.listId !== this.listId) {
      //   return
      // }
      this.todos.push(data.results as Todo)
      this.isFetching = false
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
    const lastPos = this.listPosition[this.listPosition.length - 1]
    const position = generateKeyBetween(lastPos, undefined)

    const payload = {
      listId: this.listId,
      todoId: uuid(),
      position
    }
    this.#socket?.emit('create_todo', payload)
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
