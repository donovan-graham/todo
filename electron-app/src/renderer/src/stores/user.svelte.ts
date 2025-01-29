import { jwtDecode } from 'jwt-decode'

interface TokenPayload {
  userId: string
  username: string
  createdAt: string
  exp: number
  iat: number
}

// https://svelte.dev/docs/svelte/$state#Classes
class User {
  #authToken: string = ''
  isAuthenticated: boolean = $state(false)
  username: string = $state('')
  userId: string = $state('')

  constructor() {}

  set authToken(token: string) {
    try {
      const { userId, username } = jwtDecode<TokenPayload>(token)
      this.#authToken = token
      this.username = username
      this.userId = userId
      this.isAuthenticated = true
    } catch (error) {
      console.error('Error decoding auth token: ', error)
    }
  }

  get authToken(): string {
    return this.#authToken
  }

  clear = () => {
    this.#authToken = ''
    this.username = ''
    this.userId = ''
    this.isAuthenticated = false
  }
}

export const user = new User()
