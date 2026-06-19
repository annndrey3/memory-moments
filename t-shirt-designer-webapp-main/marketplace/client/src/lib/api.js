const TOKEN_KEY = "mm_admin_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Будує query-рядок, відкидаючи порожні значення.
// Інакше URLSearchParams перетворює undefined/null на рядок "undefined",
// і сервер фільтрує за неіснуючим значенням → порожній список.
function buildQuery(params = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      clean[key] = value;
    }
  }
  return new URLSearchParams(clean).toString();
}

async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { cache: "no-store", ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getToken,
  setToken,
  clearToken,

  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  me: () => request("/auth/me"),

  getCategories: () => request("/categories"),
  getCategoriesAdmin: () => request("/categories/admin/all"),
  createCategory: (data) =>
    request("/categories", { method: "POST", body: JSON.stringify(data) }),
  updateCategory: (id, data) =>
    request(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCategory: (id) =>
    request(`/categories/${id}`, { method: "DELETE" }),

  // Слайди банера
  getSlides: () => request("/slides"),
  getSlidesAdmin: () => request("/slides/admin/all"),
  createSlide: (data) => request("/slides", { method: "POST", body: JSON.stringify(data) }),
  updateSlide: (id, data) => request(`/slides/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSlide: (id) => request(`/slides/${id}`, { method: "DELETE" }),
  seedSlidesFromCategories: () => request("/slides/seed-from-categories", { method: "POST" }),

  getProducts: (params = {}) => {
    const qs = buildQuery(params);
    return request(`/products?${qs}`);
  },

  getProductsAdmin: (params = {}) => {
    const qs = buildQuery(params);
    return request(`/products/admin/all?${qs}`);
  },

  getProductBySlug: (slug) => request(`/products/slug/${slug}`),

  getProduct: (id) => request(`/products/${id}`),

  createProduct: (data) =>
    request("/products", { method: "POST", body: JSON.stringify(data) }),

  updateProduct: (id, data) =>
    request(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteProduct: (id) =>
    request(`/products/${id}`, { method: "DELETE" }),

  // Design API
  getDesigns: (params = {}) => {
    const qs = buildQuery(params);
    return request(`/designs?${qs}`);
  },

  getDesign: (id) => request(`/designs/${id}`),

  createDesign: (data) =>
    request("/designs", { method: "POST", body: JSON.stringify(data) }),

  updateDesign: (id, data) =>
    request(`/designs/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteDesign: (id) =>
    request(`/designs/${id}`, { method: "DELETE" }),

  uploadImage: (file) => {
    const form = new FormData();
    form.append("image", file);
    return request("/upload", { method: "POST", body: form });
  },

  uploadPhoto: (file) => {
    const form = new FormData();
    form.append("photo", file);
    return request("/photos", { method: "POST", body: form });
  },

  // Orders
  createOrder: (data, idempotencyKey) =>
    request("/orders", {
      method: "POST",
      body: JSON.stringify(data),
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    }),

  trackOrder: (orderNumber) => request(`/orders/track/${orderNumber}`),

  getOrders: (params = {}) => {
    const qs = buildQuery(params);
    return request(`/orders?${qs}`);
  },

  getOrder: (id) => request(`/orders/${id}`),

  updateOrderStatus: (id, status) =>
    request(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  deleteOrder: (id) => request(`/orders/${id}`, { method: "DELETE" }),

  // Customers
  getCustomers: (params = {}) => {
    const q = buildQuery(params);
    return request(`/admin/customers${q ? `?${q}` : ""}`);
  },
  createCustomer: (data) =>
    request("/admin/customers", { method: "POST", body: JSON.stringify(data) }),
  deleteCustomer: (id) => request(`/admin/customers/${id}`, { method: "DELETE" }),

  // Services / price list
  getServices: () => request("/services"),
  getServicesAdmin: () => request("/services/admin/all"),

  createServiceCategory: (data) =>
    request("/services/categories", { method: "POST", body: JSON.stringify(data) }),
  updateServiceCategory: (id, data) =>
    request(`/services/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteServiceCategory: (id) =>
    request(`/services/categories/${id}`, { method: "DELETE" }),

  createService: (data) =>
    request("/services", { method: "POST", body: JSON.stringify(data) }),
  updateService: (id, data) =>
    request(`/services/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteService: (id) =>
    request(`/services/${id}`, { method: "DELETE" }),

  // Admin settings
  getAdminProfile: () => request("/admin/settings/profile"),
  updateAdminProfile: (data) =>
    request("/admin/settings/profile", { method: "PUT", body: JSON.stringify(data) }),
  changeAdminPassword: (data) =>
    request("/admin/settings/password", { method: "PUT", body: JSON.stringify(data) }),
  getGeminiSettings: () => request("/admin/settings/gemini"),
  setGeminiKey: (apiKey) =>
    request("/admin/settings/gemini", { method: "PUT", body: JSON.stringify({ apiKey }) }),
  deleteGeminiKey: () =>
    request("/admin/settings/gemini", { method: "DELETE" }),

  getSmtpSettings: () => request("/admin/settings/smtp"),
  setSmtpSettings: (data) =>
    request("/admin/settings/smtp", { method: "PUT", body: JSON.stringify(data) }),
  deleteSmtpSettings: () =>
    request("/admin/settings/smtp", { method: "DELETE" }),
  testSmtp: () =>
    request("/admin/settings/smtp/test", { method: "POST" }),

  // Admin user management
  getAdminUsers: () => request("/admin/settings/users"),
  createAdminUser: (data) =>
    request("/admin/settings/users", { method: "POST", body: JSON.stringify(data) }),
  updateUserPermissions: (id, permissions) =>
    request(`/admin/settings/users/${id}/permissions`, { method: "PUT", body: JSON.stringify({ permissions }) }),
  deleteAdminUser: (id) =>
    request(`/admin/settings/users/${id}`, { method: "DELETE" }),

  // Gemini price import
  importPricesPreview: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("/prices/import/preview", { method: "POST", body: form });
  },
  importPricesApply: (rows) =>
    request("/prices/import/apply", { method: "POST", body: JSON.stringify({ rows }) }),

  // Дані: імпорт / експорт через Excel (.xlsx). kind = categories | services | products
  exportDataFile: async (kind) => {
    const res = await fetch(`/api/admin/data/export/${kind}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || `Export failed: ${res.status}`);
    }
    return res.blob();
  },
  importDataFile: (kind, file) => {
    const form = new FormData();
    form.append("file", file);
    return request(`/admin/data/import/${kind}`, { method: "POST", body: form });
  },

  // Storage cleanup
  cleanupPreview: (days = 30) => request(`/admin/cleanup?days=${days}`),
  cleanupRun: (days = 30) =>
    request("/admin/cleanup", { method: "POST", body: JSON.stringify({ days }) }),
};
