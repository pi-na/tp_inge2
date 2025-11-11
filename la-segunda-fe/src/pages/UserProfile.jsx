import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api.js'

export default function UserProfile() {
  const { id } = useParams()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError('')
        const u = await api.get(`/users/${id}`)
        setUser(u)
      } catch (e) {
        setError('Usuario no encontrado')
        console.error('Error cargando usuario:', e)
      } finally {
        setLoading(false)
      }
    }
    if (id) {
      load()
    }
  }, [id])

  if (loading) return <div>Cargando…</div>
  if (error) return <div className="text-red-600">{error}</div>
  if (!user) return <div>Usuario no encontrado</div>

  return (
    <div className="max-w-lg w-full space-y-3 sm:space-y-4">
      <div className="rounded-xl border bg-white p-3 sm:p-4 space-y-3">
        <h1 className="text-lg sm:text-xl font-bold break-words">Perfil de {user.name}</h1>
        <div className="text-xs sm:text-sm text-gray-600 break-all">ID: <span className="font-mono">{user.id}</span></div>
        
        <div>
          <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">Nombre</label>
          <div className="text-sm sm:text-base break-words">{user.name}</div>
        </div>

        {user.phone && (
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">Teléfono</label>
            <div className="text-sm sm:text-base break-words">{user.phone}</div>
          </div>
        )}

        {user.description && (
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">Descripción</label>
            <div className="text-sm sm:text-base whitespace-pre-wrap break-words">{user.description}</div>
          </div>
        )}

        <div>
          <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1">Rating</label>
          <div className="text-sm sm:text-base">{user.rating.toFixed(1)} / 5.0</div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
          <div className="rounded-lg bg-gray-50 p-2 sm:p-3">
            <div className="text-xs text-gray-500">Visitados</div>
            <div className="font-semibold text-sm sm:text-base">{user.cant_events_visited}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-2 sm:p-3">
            <div className="text-xs text-gray-500">Organizados</div>
            <div className="font-semibold text-sm sm:text-base">{user.cant_events_organized}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-2 sm:p-3">
            <div className="text-xs text-gray-500">No‑shows</div>
            <div className="font-semibold text-sm sm:text-base">{user.cant_no_shows}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

