
import { Routes, Route, NavLink } from 'react-router-dom'
import Discover from './pages/Discover.jsx'
import Publish from './pages/Publish.jsx'
import Profile from './pages/Profile.jsx'
import UserProfile from './pages/UserProfile.jsx'
import Event from './pages/Event.jsx'
import MyEvents from './pages/MyEvents.jsx'
import Notifications from './pages/Notifications.jsx'
import AuthBar from './components/AuthBar.jsx'
import NotificationBell from './components/NotificationBell.jsx'
import NotificationToaster from './components/NotificationToaster.jsx'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <div className="font-semibold text-base sm:text-lg">La Segunda</div>
            <nav className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm">
              <NavLink to="/" className={({isActive}) => isActive ? "text-black font-medium" : "text-gray-600 hover:text-black"}>Descubrir</NavLink>
              <NavLink to="/my-events" className={({isActive}) => isActive ? "text-black font-medium" : "text-gray-600 hover:text-black"}>Mis Eventos</NavLink>
              <NavLink to="/publish" className={({isActive}) => isActive ? "text-black font-medium" : "text-gray-600 hover:text-black"}>Publicar</NavLink>
              <NavLink to="/notifications" className={({isActive}) => isActive ? "text-black font-medium" : "text-gray-600 hover:text-black"}>Notificaciones</NavLink>
              <NavLink to="/profile" className={({isActive}) => isActive ? "text-black font-medium" : "text-gray-600 hover:text-black"}>Perfil</NavLink>
            </nav>
            <div className="ml-auto w-full sm:w-auto flex items-center gap-2">
              <NotificationBell />
              <AuthBar />
            </div>
          </div>
        </div>
      </header>
      <NotificationToaster />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <Routes>
            <Route path="/" element={<Discover />} />
            <Route path="/my-events" element={<MyEvents />} />
            <Route path="/publish" element={<Publish />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/users/:id" element={<UserProfile />} />
            <Route path="/events/:id" element={<Event />} />
          </Routes>
        </div>
      </main>
      <footer className="text-xs text-gray-500 border-t">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4 text-center sm:text-left">
          MVP académico — sin seguridad real. API: {import.meta.env.VITE_API_URL || "http://localhost:8000"}
        </div>
      </footer>
    </div>
  )
}
