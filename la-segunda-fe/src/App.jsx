
import { Routes, Route, NavLink } from 'react-router-dom'
import Discover from './pages/Discover.jsx'
import Publish from './pages/Publish.jsx'
import Profile from './pages/Profile.jsx'
import Event from './pages/Event.jsx'
import AuthBar from './components/AuthBar.jsx'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="font-semibold text-lg">La Segunda</div>
          <nav className="flex gap-3 text-sm">
            <NavLink to="/" className={({isActive}) => isActive ? "text-black font-medium" : "text-gray-600 hover:text-black"}>Descubrir</NavLink>
            <NavLink to="/publish" className={({isActive}) => isActive ? "text-black font-medium" : "text-gray-600 hover:text-black"}>Publicar</NavLink>
            <NavLink to="/profile" className={({isActive}) => isActive ? "text-black font-medium" : "text-gray-600 hover:text-black"}>Perfil</NavLink>
          </nav>
          <div className="ml-auto"><AuthBar /></div>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Discover />} />
            <Route path="/publish" element={<Publish />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/events/:id" element={<Event />} />
          </Routes>
        </div>
      </main>
      <footer className="text-xs text-gray-500 border-t">
        <div className="max-w-5xl mx-auto px-4 py-4">
          MVP académico — sin seguridad real. API: {import.meta.env.VITE_API_URL || "http://localhost:8000"}
        </div>
      </footer>
    </div>
  )
}
