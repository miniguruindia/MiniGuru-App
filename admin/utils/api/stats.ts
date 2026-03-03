"use server"
import { apiClient } from "./apiClient"

const DEFAULT_STATS = {
  total: { users: 0, projects: 0, orders: 0, products: 0 },
  new:   { users: 0, projects: 0, orders: 0 },
}

export const getStats = async () => {
  try {
    const response = await apiClient.get('/admin/stats')
    // Deep merge so missing fields from backend never crash the dashboard
    return {
      total: { ...DEFAULT_STATS.total, ...(response.data?.total ?? {}) },
      new:   { ...DEFAULT_STATS.new,   ...(response.data?.new   ?? {}) },
    }
  } catch (error: any) {
    // Log the real error for debugging but never crash the dashboard
    const status = error?.response?.status
    if (status === 403) {
      console.error('Stats: Access forbidden (403) — check admin token')
    } else if (status === 404) {
      console.error('Stats: Endpoint not found (404) — backend needs GET /admin/stats')
    } else if (status === 502 || status === 503) {
      console.error('Stats: Backend is down (502/503) — check your server')
    } else {
      console.error('Stats: Failed to fetch —', error?.message)
    }
    // Return zeros so the dashboard always renders
    return DEFAULT_STATS
  }
}