import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

function getNotificationIcon(type) {
  switch (type) {
    case 'new_application':
      return '👤'
    case 'application_accepted':
      return '✅'
    case 'application_rejected':
      return '❌'
    case 'event_started':
      return '🚀'
    case 'event_finished':
      return '🏁'
    case 'event_cancelled':
      return '🚫'
    default:
      return '🔔'
  }
}

function getNotificationColor(type) {
  switch (type) {
    case 'new_application':
      return 'bg-blue-500'
    case 'application_accepted':
      return 'bg-green-500'
    case 'application_rejected':
      return 'bg-red-500'
    case 'event_started':
      return 'bg-purple-500'
    case 'event_finished':
      return 'bg-yellow-500'
    case 'event_cancelled':
      return 'bg-gray-500'
    default:
      return 'bg-sky-500'
  }
}

export default function ToastNotification({ notification, onClose }) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Animación de entrada
    setTimeout(() => setIsVisible(true), 10)
    
    // Auto-cerrar después de 5 segundos
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onClose(), 300) // Esperar a que termine la animación
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => onClose(), 300)
  }

  return (
    <div
      className={`
        fixed top-4 right-4 z-50 max-w-sm w-full
        transform transition-all duration-300 ease-out
        ${isVisible && !isExiting ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}
        ${getNotificationColor(notification.type)} text-white rounded-lg shadow-2xl
        overflow-hidden
      `}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl flex-shrink-0">
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h4 className="font-semibold text-sm mb-1">{notification.title}</h4>
                <p className="text-xs opacity-90 break-words">{notification.message}</p>
                {notification.event_id && (
                  <Link
                    to={`/events/${notification.event_id}`}
                    className="text-xs underline opacity-90 hover:opacity-100 mt-1 inline-block"
                    onClick={handleClose}
                  >
                    Ver evento →
                  </Link>
                )}
              </div>
              <button
                onClick={handleClose}
                className="flex-shrink-0 text-white opacity-70 hover:opacity-100 transition"
                aria-label="Cerrar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

