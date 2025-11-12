// Auth utilities para La Segunda
import { api } from './api.js'

const USER_ID_KEY = 'userId'
const USER_NAME_KEY = 'userName'

export function getUserId() {
  return localStorage.getItem(USER_ID_KEY)
}

export function getUserName() {
  return localStorage.getItem(USER_NAME_KEY)
}

export function setUserId(id) {
  localStorage.setItem(USER_ID_KEY, id)
}

export function setUserName(name) {
  localStorage.setItem(USER_NAME_KEY, name)
}

export function logout() {
  localStorage.removeItem(USER_ID_KEY)
  localStorage.removeItem(USER_NAME_KEY)
}

export async function login(name) {
  const user = await api.post('/users/login', { name })
  setUserId(user.id)
  setUserName(user.name)
  return user
}

export async function register(name) {
  const user = await api.post('/users/register', { name })
  setUserId(user.id)
  setUserName(user.name)
  return user
}

