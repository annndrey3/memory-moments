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

  // Orders
  createOrder: (data) =>
    request("/orders", { method: "POST", body: JSON.stringify(data) }),

  trackOrder: (orderNumber) => request(`/orders/track/${orderNumber}`),

  getOrders: (params = {}) => {
    const qs = buildQuery(params);
    return request(`/orders?${qs}`);
  },

  getOrder: (id) => request(`/orders/${id}`),

  updateOrderStatus: (id, status) =>
    request(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

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
};
