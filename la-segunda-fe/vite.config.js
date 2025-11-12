
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { 
    port: 5173, 
    host: '0.0.0.0',  // Permitir acceso desde fuera del contenedor
    // Permitir todos los hosts (útil para ngrok y desarrollo)
    // En producción, especifica hosts específicos por seguridad
    allowedHosts: true,
    watch: {
      usePolling: true  // Necesario para hot reload en Docker
    }
  }
})
