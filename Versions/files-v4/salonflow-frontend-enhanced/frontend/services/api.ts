import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // The session token now lives in an httpOnly cookie set by the backend
  // (see CHANGES.md) rather than in localStorage, so it must be sent
  // automatically with every request instead of attached manually via an
  // Authorization header. This is what makes that possible for
  // cross-origin requests (frontend and backend on different domains).
  withCredentials: true,
})

// Handle 401 errors - clear any locally-cached (non-sensitive) user info
// and redirect to login. The actual session cookie is cleared server-side
// by /auth/logout, or simply expires/is already invalid by the time we get
// a 401 here.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear()
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login'
      }
    }
    return Promise.reject(error)
  }
)

// Auth API calls
export const authApi = {
  // FIXED: this previously posted to '/auth/register', which does not
  // exist on the backend (only '/auth/register-customer' and '/auth/staff'
  // do) - self-registration always creates a customer account, by design;
  // owner/staff accounts are provisioned separately (see backend
  // database/owner_creation_script.md and the staff creation endpoint).
  registerCustomer: (data: any) => api.post('/auth/register-customer', { ...data, role: 'customer' }),
  login: (login: string, password: string) =>
    api.post('/auth/login', new URLSearchParams({
      username: login,
      password: password,
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }),
  // The backend now sets/clears the session cookie itself, so logout is a
  // real API call rather than a purely client-side "delete from
  // localStorage" action (the frontend has no way to read or delete an
  // httpOnly cookie directly).
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
}

export const customersApi = {
  getAll: (params?: { search?: string; limit?: number; offset?: number }) =>
    api.get('/customers', { params }),
  getOne: (id: string) =>
    api.get(`/customers/${id}`),
  create: (data: any) =>
    api.post('/customers', data),
  update: (id: string, data: any) =>
    api.put(`/customers/${id}`, data),
  delete: (id: string) =>
    api.delete(`/customers/${id}`),
}

export const appointmentsApi = {
  getAll: (params?: { start_date?: string; end_date?: string; status?: string; limit?: number }) =>
    api.get('/appointments', { params }),
  getOne: (id: string) =>
    api.get(`/appointments/${id}`),
  create: (data: any) =>
    api.post('/appointments', data),
  update: (id: string, data: any) =>
    api.put(`/appointments/${id}`, data),
  delete: (id: string) =>
    api.delete(`/appointments/${id}`),
  updateStatus: (id: string, status: string) =>
    api.patch(`/appointments/${id}/status`, null, { params: { status } }),
  approve: (id: string, data?: { new_date?: string; new_time?: string; reason?: string }) =>
    api.patch(`/appointments/${id}/approve`, data || {}),
  respond: (id: string, accept: boolean) =>
    api.patch(`/appointments/${id}/respond`, { accept }),
  getCustomerAppointments: () =>
    api.get('/appointments/customer/appointments'),
  getByCustomer: (customerId: string) =>
    api.get(`/appointments/by-customer/${customerId}`),
  getNotifications: () =>
    api.get('/appointments/notifications'),
  markNotificationRead: (id: string) =>
    api.patch(`/appointments/notifications/${id}/read`),
}

export const billingApi = {
  getAll: (params?: { customer_id?: string; start_date?: string; end_date?: string }) =>
    api.get('/billing/invoices', { params }),
  getOne: (id: string) =>
    api.get(`/billing/invoices/${id}`),
  create: (data: any) =>
    api.post('/billing/invoices', data),
  delete: (id: string) =>
    api.delete(`/billing/invoices/${id}`),
  getStats: (period?: string) =>
    api.get('/billing/stats', { params: { period } }),
  downloadPDF: (id: string) =>
    api.get(`/billing/invoices/${id}/pdf`, { responseType: 'blob' }),
  printPDF: (id: string) =>
    api.get(`/billing/invoices/${id}/print`, { responseType: 'blob' }),
  addPayment: (invoiceId: string, data: { amount: number; payment_method: string; payment_date?: string; notes?: string }) =>
    api.post(`/billing/invoices/${invoiceId}/payments`, data),
  getPayments: (invoiceId: string) =>
    api.get(`/billing/invoices/${invoiceId}/payments`),
  // Customer-scoped: a customer can only ever see their own invoices
  // through these (separate, narrower) endpoints - not the salon-wide ones
  // above, which require owner/staff.
  getMyInvoices: (params?: { start_date?: string; end_date?: string }) =>
    api.get('/billing/my-invoices', { params }),
  getMyInvoice: (id: string) =>
    api.get(`/billing/my-invoices/${id}`),
  downloadMyInvoicePDF: (id: string) =>
    api.get(`/billing/my-invoices/${id}/pdf`, { responseType: 'blob' }),
}

export const staffApi = {
  getAll: () =>
    api.get('/staff'),
  create: (data: { email: string; full_name: string; phone?: string; position?: string; permissions?: Record<string, boolean> }) =>
    api.post('/auth/staff', data),
  update: (id: string, data: { position?: string; phone?: string; permissions?: Record<string, boolean>; is_active?: boolean }) =>
    api.put(`/staff/${id}`, data),
  delete: (id: string) =>
    api.delete(`/staff/${id}`),
}

export const servicesApi = {
  getAll: (activeOnly = false) =>
    api.get('/services', { params: { active_only: activeOnly } }),
  create: (data: { name: string; description?: string; duration: number; price: number; category?: string; is_active?: boolean }) =>
    api.post('/services', data),
  update: (id: string, data: Partial<{ name: string; description: string; duration: number; price: number; category: string; is_active: boolean }>) =>
    api.put(`/services/${id}`, data),
  delete: (id: string) =>
    api.delete(`/services/${id}`),
}

export const feedbackApi = {
  // Owner/staff: all feedback for the salon.
  getAll: (serviceId?: string) =>
    api.get('/feedback', { params: serviceId ? { service_id: serviceId } : {} }),
  // Customer: feedback they've personally left.
  getMine: () =>
    api.get('/feedback/my-feedback'),
  create: (data: { appointment_id: string; rating: number; comment?: string }) =>
    api.post('/feedback', data),
}

export const salonsApi = {
  setup: (data: any) =>
    api.post('/salons/setup', data),
  getMine: () =>
    api.get('/salons/my-salon'),
}

export const dashboardApi = {
  getStats: () =>
    api.get('/dashboard/stats'),
}
