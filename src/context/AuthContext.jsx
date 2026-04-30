import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI } from '../api/auth'
import { customersAPI } from '../api/customers'

const AuthContext = createContext(null)

// ─── helpers ─────────────────────────────────────────────────────────────────
// Backend: PropertyNamingPolicy = null  →  PascalCase properties
//          JsonStringEnumConverter      →  enum as string ("Admin", "Customer"…)
//
// After axios interceptor unwraps { message, data }, res.data is the payload:
//   Login:  { Token, User: { UserId, Name, Email, Phone, Roles:[{RoleType:"Admin"}] } }
//   Others: the DTO object directly

function extractRoleString(rawUser) {
  // Roles is [{UserRoleId, RoleId, RoleType:"Admin", IsActive, CreatedAt}, ...]
  const roles = rawUser?.Roles ?? rawUser?.roles ?? []
  if (roles.length > 0) {
    return roles[0].RoleType ?? roles[0].roleType ?? null
  }
  return rawUser?.Role ?? rawUser?.role ?? null
}

function normalizeUser(raw) {
  if (!raw) return null
  const roleStr = extractRoleString(raw)
  return {
    userId: raw.UserId ?? raw.userId,
    name:   raw.Name  ?? raw.name,
    email:  raw.Email ?? raw.email,
    phone:  raw.Phone ?? raw.phone,
    role:   roleStr,                        // single primary role string e.g. "Admin"
    roles:  (raw.Roles ?? raw.roles ?? []).map((r) => r.RoleType ?? r.roleType ?? r),
    status: raw.Status ?? raw.status,
  }
}
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('swiftpay_user') || 'null') }
    catch { return null }
  })
  const [token, setToken]             = useState(() => localStorage.getItem('swiftpay_token'))
  const [customerProfile, setCustomerProfile] = useState(null)
  const [loading, setLoading]         = useState(false)

  const role = user?.role ?? null

  // Fetch customer profile once logged-in as Customer
  useEffect(() => {
    if (user?.userId && role === 'Customer') {
      customersAPI.getByUserId(user.userId)
        .then((res) => setCustomerProfile(res.data))   // interceptor already unwrapped
        .catch(() => setCustomerProfile(null))
    }
  }, [user?.userId, role])

  const login = useCallback(async (email, password) => {
    setLoading(true)
    try {
      // Send PascalCase to match backend RegisterUserDto / LoginDto
      const res = await authAPI.login({ Email: email, Password: password })
      // After interceptor: res.data = { Token, User: {...} }
      const jwt     = res.data?.Token ?? res.data?.token
      const rawUser = res.data?.User  ?? res.data?.user

      if (!jwt || !rawUser) throw new Error('Unexpected server response')

      const normalizedUser = normalizeUser(rawUser)
      localStorage.setItem('swiftpay_token', jwt)
      localStorage.setItem('swiftpay_user', JSON.stringify(normalizedUser))
      setToken(jwt)
      setUser(normalizedUser)
      return { success: true, user: normalizedUser }
    } catch (err) {
      const msg = err.response?.data?.message
        ?? err.response?.data?.Message
        ?? err.message
        ?? 'Login failed'
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [])

  const register = useCallback(async (data) => {
    setLoading(true)
    try {
      const res = await authAPI.register({
        Name:     data.name,
        Email:    data.email,
        Phone:    data.phone || '',
        Password: data.password,
      })
      return { success: true, data: res.data }
    } catch (err) {
      const msg = err.response?.data?.message
        ?? err.response?.data?.Message
        ?? 'Registration failed'
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('swiftpay_token')
    localStorage.removeItem('swiftpay_user')
    setToken(null)
    setUser(null)
    setCustomerProfile(null)
  }, [])

  const hasRole = useCallback((...roles) => {
    if (!user) return false
    return roles.some((r) => user.roles?.includes(r) || user.role === r)
  }, [user])

  return (
    <AuthContext.Provider value={{ user, token, role, customerProfile, loading, login, register, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
