import { useState, useEffect } from 'react'
import ToastNotification from './ToastNotification.jsx'
import { useNotifications } from '../hooks/useNotifications.js'

export default function NotificationToaster() {
  const { notifications } = useNotifications()
  const [toasts, setToasts] = useState([])
  const [shownIds, setShownIds] = useState(new Set())

  useEffect(() => {
    // Mostrar solo notificaciones nuevas (no leídas y que no hayamos mostrado)
    const newNotifications = notifications.filter(
      n => !n.read && !shownIds.has(n.id)
    )

    if (newNotifications.length > 0) {
      // Agregar las nuevas notificaciones como toasts
      setToasts(prev => [...prev, ...newNotifications])
      // Marcar como mostradas
      setShownIds(prev => new Set([...prev, ...newNotifications.map(n => n.id)]))
    }
  }, [notifications, shownIds])

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="fixed top-0 right-0 z-50 pointer-events-none">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className="pointer-events-auto"
          style={{
            marginTop: `${index * 80}px`, // Espaciado entre toasts
          }}
        >
          <ToastNotification
            notification={toast}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </div>
  )
}

