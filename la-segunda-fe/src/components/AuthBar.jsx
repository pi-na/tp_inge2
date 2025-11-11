
import { useEffect, useState } from 'react'
import { login, register, getUserId, getUserName, setUserId, logout } from '../lib/auth.js'

export default function AuthBar() {
  const [userId, setId] = useState(getUserId())
  const [name, setName] = useState(getUserName() || '')
  const [manualId, setManualId] = useState('')
  const [error, setError] = useState('')

  useEffect(()=>{
    setId(getUserId())
    setName(getUserName() || '')
  }, [])

  async function onLogin() {
    if (!name.trim()) return;
    setError('');
    try {
      const u = await login(name.trim());
      setId(u.id);
      setName(u.name);
    } catch (e) {
      setError('Usuario no encontrado');
    }
  }

  async function onRegister() {
    if (!name.trim()) return;
    setError('');
    try {
      const u = await register(name.trim());
      setId(u.id);
      setName(u.name);
    } catch (e) {
      const msg = e.message || 'Error al crear usuario';
      if (msg.includes('Ya existe') || msg.includes('409')) {
        setError('Ya existe un usuario con ese nombre');
      } else {
        setError(msg);
      }
    }
  }

  function onManualSet() {
    if (!manualId.trim()) return;
    setUserId(manualId.trim());
    setId(manualId.trim());
    setError('');
  }

  function onLogout() {
    logout();
    setId(null);
    setName('');
    setError('');
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {!userId ? (
        <div className="flex items-center gap-2">
          <input className="border rounded px-2 py-1" placeholder="Tu nombre" value={name} onChange={e=>{setName(e.target.value); setError('')}} />
          <button onClick={onLogin} className="px-3 py-1 rounded bg-green-500 text-white">Ingresar</button>
          <button onClick={onRegister} className="px-3 py-1 rounded bg-sky-500 text-white">Crear usuario</button>
          {error && <span className="text-red-600 text-xs">{error}</span>}
          <input className="border rounded px-2 py-1" placeholder="o pegar X-User-Id" value={manualId} onChange={e=>setManualId(e.target.value)} />
          <button onClick={onManualSet} className="px-3 py-1 rounded border">Usar ID</button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-gray-600">{getUserName() || `ID: ${userId.slice(0,6)}…`}</span>
          <button onClick={onLogout} className="px-3 py-1 rounded border">Salir</button>
        </div>
      )}
    </div>
  )
}
