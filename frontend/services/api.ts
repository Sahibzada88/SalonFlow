import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})


// ✅ Handle 401 errors - clear storage and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log('🔴 Token expired or invalid - logging out')
      localStorage.clear()
      // ✅ Redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login'
      }
    }
    return Promise.reject(error)
  }
)

// Auth API calls
export const authApi = {
  register: (data: any) => api.post('/auth/register', data),
  login: (email: string, password: string) => 
    api.post('/auth/login', new URLSearchParams({
      username: email,
      password: password,
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
}



// Add after authApi
export const customersApi = {
  // Get all customers
  getAll: (params?: { search?: string; limit?: number; offset?: number }) => 
    api.get('/customers', { params }),
  
  // Get single customer
  getOne: (id: string) => 
    api.get(`/customers/${id}`),
  
  // Create customer
  create: (data: any) => 
    api.post('/customers', data),
  
  // Update customer
  update: (id: string, data: any) => 
    api.put(`/customers/${id}`, data),
  
  // Delete customer
  delete: (id: string) => 
    api.delete(`/customers/${id}`),
  
  // Get customer stats
  getStats: (id: string) => 
    api.get(`/customers/${id}/stats`),
}



// Add after customersApi
export const appointmentsApi = {
  // Get all appointments
  getAll: (params?: { start_date?: string; end_date?: string; status?: string; limit?: number }) => 
    api.get('/appointments', { params }),
  
  // Get today's appointments
  getToday: () => 
    api.get('/appointments/today'),
  
  // Get single appointment
  getOne: (id: string) => 
    api.get(`/appointments/${id}`),
  
  // Create appointment
  create: (data: any) => 
    api.post('/appointments', data),
  
  // Update appointment
  update: (id: string, data: any) => 
    api.put(`/appointments/${id}`, data),
  
  // Update status
  updateStatus: (id: string, status: string) => 
    api.patch(`/appointments/${id}/status`, null, { params: { status } }),
  
  // Delete appointment
  delete: (id: string) => 
    api.delete(`/appointments/${id}`),


  getCustomerAppointments: () => 
    api.get('/appointments/customer/appointments'),

  getByCustomer: (customerId: string) => 
    api.get(`/appointments/by-customer/${customerId}`),
}




// Add after appointmentsApi
export const billingApi = {
  // Get all invoices
  getAll: (params?: { customer_id?: string; start_date?: string; end_date?: string }) => 
    api.get('/billing/invoices', { params }),
  
  // Get single invoice
  getOne: (id: string) => 
    api.get(`/billing/invoices/${id}`),
  
  // Create invoice
  create: (data: any) => 
    api.post('/billing/invoices', data),
  
  // Delete invoice
  delete: (id: string) => 
    api.delete(`/billing/invoices/${id}`),
  
  // Get billing stats
  getStats: (period?: string) => 
    api.get('/billing/stats', { params: { period } }),

    // Download PDF
  downloadPDF: (id: string) => 
    api.get(`/billing/invoices/${id}/pdf`, { responseType: 'blob' }),

  printPDF: (id: string) => 
    api.get(`/billing/invoices/${id}/print`, { responseType: 'blob' }),


    // Add payment to invoice
  addPayment: (invoiceId: string, data: { amount: number; payment_method: string; payment_date?: string; notes?: string }) =>
    api.post(`/billing/invoices/${invoiceId}/payments`, data),

  // Get payments for an invoice
  getPayments: (invoiceId: string) =>
    api.get(`/billing/invoices/${invoiceId}/payments`),

}