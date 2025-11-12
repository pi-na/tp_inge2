import { Link } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'

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
      return 'bg-blue-50 border-blue-200'
    case 'application_accepted':
      return 'bg-green-50 border-green-200'
    case 'application_rejected':
      return 'bg-red-50 border-red-200'
    case 'event_started':
      return 'bg-purple-50 border-purple-200'
    case 'event_finished':
      return 'bg-yellow-50 border-yellow-200'
    case 'event_cancelled':
      return 'bg-gray-50 border-gray-200'
    default:
      return 'bg-white border-gray-200'
  }
}

export default function Notifications() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh } = useNotifications()

  if (loading) {
    return <div className="text-center py-8">Cargando notificaciones...</div>
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">
          Notificaciones
          {unreadCount > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-600">
              ({unreadCount} sin leer)
            </span>
          )}
        </h1>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-3 sm:px-4 py-2 rounded bg-sky-500 text-white hover:bg-sky-600 text-sm sm:text-base whitespace-nowrap"
            >
              Marcar todas como leídas
            </button>
          )}
          <button
            onClick={refresh}
            className="px-3 sm:px-4 py-2 rounded border hover:bg-gray-50 text-sm sm:text-base whitespace-nowrap"
          >
            Actualizar
          </button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <div className="text-4xl mb-4">🔔</div>
          <p>No tienes notificaciones aún</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`rounded-xl border p-3 sm:p-4 transition ${
                notification.read
                  ? getNotificationColor(notification.type)
                  : `${getNotificationColor(notification.type)} ring-2 ring-blue-300`
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base mb-1">
                        {notification.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-700 mb-2 break-words">
                        {notification.message}
                      </p>
                      {notification.event_id && (
                        <Link
                          to={`/events/${notification.event_id}`}
                          className="text-xs sm:text-sm text-sky-600 hover:text-sky-800 inline-block"
                        >
                          Ver evento →
                        </Link>
                      )}
                      <div className="text-xs text-gray-500 mt-2">
                        {new Date(notification.created_at).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="px-2 py-1 rounded border text-xs hover:bg-gray-100 whitespace-nowrap flex-shrink-0"
                        title="Marcar como leída"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

