import { api } from './client'
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User
} from '@/types/auth'

export const authApi = {
  register: (data: RegisterRequest) =>
    api.post<AuthResponse>('/auth/register', data),

  login: (data: LoginRequest) =>
    api.post<AuthResponse>('/auth/login', data),

  getMe: () =>
    api.get<{ user: User }>('/auth/me')
}
