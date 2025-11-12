// API client para La Segunda
// Configuración flexible para desarrollo local, IP local y ngrok
function getApiUrl() {
  // 1. Si hay variable de entorno, usarla (prioridad máxima - para ngrok)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  const hostname = window.location.hostname
  const protocol = window.location.protocol
  
  // 2. Si estamos en localhost, usar 127.0.0.1 (IPv4) para evitar problemas con IPv6
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://127.0.0.1:8000'
  }
  
  // 3. Si es ngrok (detectado por el dominio .ngrok-free.app o .ngrok.io)
  // IMPORTANTE: Si el frontend está en ngrok (HTTPS), el backend también debe estar en ngrok (HTTPS)
  // para evitar Mixed Content errors
  if (hostname.includes('ngrok')) {
    // Si VITE_API_URL está configurado, usarlo (debe ser la URL HTTPS del backend en ngrok)
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL
    }
    // Si no está configurado, mostrar error claro
    console.error('❌ Frontend en ngrok pero VITE_API_URL no está configurado.')
    console.error('   Ejecuta: ./config-ngrok.sh para configurarlo')
    console.error('   O edita la-segunda-fe/.env y agrega: VITE_API_URL=https://tu-backend-ngrok.ngrok-free.app')
    // Intentar usar el mismo hostname como fallback (solo funciona si ambos están en el mismo ngrok)
    return `${protocol}//${hostname}`
  }
  
  // 4. Si accedemos desde IP local (misma red WiFi), usar esa IP con puerto 8000
  // PERO: Si estamos en HTTPS (ngrok), no podemos usar HTTP (Mixed Content)
  if (protocol === 'https:') {
    console.error('❌ Frontend en HTTPS pero intentando conectar a HTTP. Configura VITE_API_URL con la URL HTTPS del backend.')
    // Intentar usar el mismo hostname (asumiendo que el backend también está en ngrok)
    return `${protocol}//${hostname}`
  }
  
  if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(hostname)) {
    return `http://${hostname}:8000`
  }
  
  // 5. Fallback: usar el mismo hostname con puerto 8000
  return `http://${hostname}:8000`
}

const API_URL = getApiUrl()

// Log para debugging (solo en desarrollo)
if (import.meta.env.DEV) {
  console.log('🔗 API URL configurada:', API_URL)
}

function getHeaders() {
  const userId = localStorage.getItem('userId')
  const headers = { 
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'  // Bypass ngrok browser warning
  }
  if (userId) {
    headers['X-User-Id'] = userId
  }
  return headers
}

export const api = {
  async get(url) {
    const res = await fetch(`${API_URL}${url}`, {
      headers: getHeaders()
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || `Error ${res.status}`)
    }
    return res.json()
  },

  async post(url, body) {
    const res = await fetch(`${API_URL}${url}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || `Error ${res.status}`)
    }
    return res.json()
  },

  async patch(url, body) {
    const res = await fetch(`${API_URL}${url}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || `Error ${res.status}`)
    }
    return res.json()
  },

  async del(url) {
    const res = await fetch(`${API_URL}${url}`, {
      method: 'DELETE',
      headers: getHeaders()
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || `Error ${res.status}`)
    }
    return res.json()
  }
}

