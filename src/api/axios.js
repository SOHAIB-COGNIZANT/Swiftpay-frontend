import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('swiftpay_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// Auto-unwrap { message, data } envelope + handle 401 globally
api.interceptors.response.use(
  (response) => {
    const body = response.data
    // Backend returns { message: "...", data: <payload> }
    // Unwrap so callers get res.data = the actual payload
    if (body && typeof body === 'object' && 'data' in body && 'message' in body) {
      response.data = body.data
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('swiftpay_token')
      localStorage.removeItem('swiftpay_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
