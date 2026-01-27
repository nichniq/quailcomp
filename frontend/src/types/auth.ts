export interface User {
  userId: number
  email: string
  username: string | null
}

export interface RegisterRequest {
  email: string
  username?: string
  password: string
}

export interface LoginRequest {
  identifier: string
  password: string
}

export interface AuthResponse {
  user: User
  token: string
  expiresAt: string
}

export interface ApiError {
  error: string
  code: string
}

export type AuthErrorCode =
  | 'EMAIL_EXISTS'
  | 'USERNAME_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'PASSWORD_TOO_SHORT'
  | 'USER_NOT_FOUND'
  | 'MISSING_FIELDS'
  | 'INVALID_BODY'
