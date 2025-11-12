
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { 
    port: 5173, 
    host: true,
    // Permitir todos los hosts (útil para ngrok y desarrollo)
    // En producción, especifica hosts específicos por seguridad
    allowedHosts: true
  }
})
