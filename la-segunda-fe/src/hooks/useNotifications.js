import { useEffect, useState, useRef } from 'react'
import { getUserId } from '../lib/auth.js'
import { api } from '../lib/api.js'

export function useNotifications() {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const eventSourceRef = useRef(null)

  useEffect(() => {
    const userId = getUserId()
    if (!userId) {
      setLoading(false)
      return () => {} // Return empty cleanup function
    }

    // Cargar notificaciones históricas
    async function loadNotifications() {
      try {
        const data = await api.get('/notifications?limit=50')
        setNotifications(data)
        const unread = data.filter(n => !n.read).length
        setUnreadCount(unread)
      } catch (err) {
        console.error('Error cargando notificaciones:', err)
      } finally {
        setLoading(false)
      }
    }

    loadNotifications()

    // Conectar a SSE - usar la misma lógica que api.js
    function getApiUrl() {
      // 1. Variable de entorno tiene prioridad
      if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL
      }
      
      const hostname = window.location.hostname
      const protocol = window.location.protocol
      
      // 2. Localhost
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8000'
      }
      
      // 3. Ngrok - si frontend está en HTTPS, backend también debe estar
      if (hostname.includes('ngrok')) {
        console.warn('⚠️ Ngrok detectado para SSE. Asegúrate de configurar VITE_API_URL si el backend está en otro ngrok.')
        return `${protocol}//${hostname}`
      }
      
      // 4. Si estamos en HTTPS pero no es ngrok, no podemos usar HTTP (Mixed Content)
      if (protocol === 'https:') {
        console.error('❌ Frontend en HTTPS pero intentando conectar SSE a HTTP. Configura VITE_API_URL.')
        return `${protocol}//${hostname}`
      }
      
      // 5. IP local
      if (/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(hostname)) {
        return `http://${hostname}:8000`
      }
      
      // 6. Fallback
      return `http://${hostname}:8000`
    }

    const apiUrl = getApiUrl()
    // Para SSE, necesitamos incluir el header X-User-Id en la URL como query param
    // porque EventSource no soporta headers personalizados
    // También agregamos ngrok-skip-browser-warning como query param
    const sseUrl = `${apiUrl}/notifications/stream?X-User-Id=${encodeURIComponent(userId)}&ngrok-skip-browser-warning=true`
    console.log('🔔 Conectando a SSE:', sseUrl)
    const eventSource = new EventSource(sseUrl)

    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log('✅ SSE conectado exitosamente')
    }

    eventSource.onmessage = (event) => {
      console.log('📨 Mensaje SSE recibido:', event.data)
      
      // Intentar parsear el mensaje
      let notificationData = null
      
      // Formato 1: "data: {...}"
      if (event.data.startsWith('data: ')) {
        try {
          notificationData = JSON.parse(event.data.slice(6))
        } catch (err) {
          console.error('❌ Error parseando formato "data: {...}":', err)
        }
      }
      // Formato 2: JSON directo (puede pasar con algunos navegadores)
      else if (event.data.trim().startsWith('{')) {
        try {
          notificationData = JSON.parse(event.data)
        } catch (err) {
          console.error('❌ Error parseando JSON directo:', err)
        }
      }
      // Keepalive
      else if (event.data.trim() === 'keepalive' || event.data.startsWith(': keepalive')) {
        console.log('💓 SSE keepalive recibido')
        return
      }
      else {
        console.log('⚠️ Mensaje SSE desconocido:', event.data)
        return
      }
      
      // Si tenemos una notificación válida, procesarla
      if (notificationData && notificationData.type) {
        console.log('✅ Notificación parseada:', notificationData)
        setNotifications(prev => [notificationData, ...prev])
        setUnreadCount(prev => prev + 1)
      }
    }

    eventSource.onerror = (error) => {
      console.error('❌ Error en SSE:', error)
      console.log('Estado del EventSource:', eventSource.readyState)
      // 0 = CONNECTING, 1 = OPEN, 2 = CLOSED
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log('🔄 SSE cerrado, intentando reconectar...')
      }
      // El navegador reconecta automáticamente
    }

    return () => {
      eventSource.close()
    }
  }, [])

  const markAsRead = async (notificationId) => {
    try {
      await api.patch(`/notifications/${notificationId}/read`)
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error marcando notificación como leída:', err)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Error marcando todas como leídas:', err)
    }
  }

  const refresh = async () => {
    try {
      const data = await api.get('/notifications?limit=50')
      setNotifications(data)
      const unread = data.filter(n => !n.read).length
      setUnreadCount(unread)
    } catch (err) {
      console.error('Error refrescando notificaciones:', err)
    }
  }

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh,
  }
}

