# Solución para Mixed Content con Ngrok

## Problema

Cuando el frontend está en ngrok (HTTPS) e intenta conectarse al backend en HTTP (IP local), el navegador bloquea la conexión por **Mixed Content**.

## Solución

### Opción 1: Usar ngrok también para el backend (Recomendado)

1. **Inicia ngrok para el backend:**
```bash
ngrok http 8000
```

2. **Copia la URL HTTPS que te da ngrok**, por ejemplo:
```
https://xxxx-xx-xx-xx-xx.ngrok-free.app
```

3. **Configura la variable de entorno en el frontend:**
Crea o edita `la-segunda-fe/.env`:
```bash
VITE_API_URL=https://xxxx-xx-xx-xx-xx.ngrok-free.app
```

4. **Reinicia el servidor de Vite:**
```bash
cd la-segunda-fe
npm run dev
```

### Opción 2: Usar solo IP local (sin ngrok)

Si no necesitas acceder desde fuera de tu red local:

1. **No uses ngrok para el frontend**
2. **Accede directamente con la IP local:**
```
http://192.168.1.96:5173
```

El código detectará automáticamente la IP local y usará `http://192.168.1.96:8000` para el backend.

### Opción 3: Usar ngrok para ambos (Frontend y Backend)

1. **Terminal 1 - Backend:**
```bash
ngrok http 8000
# Copia la URL HTTPS, ej: https://backend-xxxx.ngrok-free.app
```

2. **Terminal 2 - Frontend:**
```bash
ngrok http 5173
# Copia la URL HTTPS, ej: https://frontend-xxxx.ngrok-free.app
```

3. **Configura `.env` en el frontend:**
```bash
VITE_API_URL=https://backend-xxxx.ngrok-free.app
```

4. **Accede al frontend desde la URL de ngrok:**
```
https://frontend-xxxx.ngrok-free.app
```

## Verificación

Después de configurar, verifica en la consola del navegador:
```
🔗 API URL configurada: https://xxxx-xx-xx-xx-xx.ngrok-free.app
```

Si ves una URL HTTP cuando estás en HTTPS, hay un problema de configuración.

## Troubleshooting

### Error: "Mixed Content"
- **Causa**: Frontend en HTTPS intentando conectar a HTTP
- **Solución**: Usa ngrok para el backend también, o configura `VITE_API_URL`

### Error: "CORS policy"
- **Causa**: El backend no permite el origen del frontend
- **Solución**: El backend ya está configurado para permitir todos los orígenes en desarrollo

### Error: "Address already in use" (puerto 8000)
```bash
# Matar proceso en puerto 8000
lsof -ti:8000 | xargs kill -9
```

### Las notificaciones no funcionan
1. Verifica que RabbitMQ esté corriendo: `docker ps | grep rabbitmq`
2. Verifica que el backend esté corriendo y conectado a RabbitMQ
3. Abre la consola del navegador y busca los logs de SSE:
   - `🔔 Conectando a SSE: ...`
   - `✅ SSE conectado exitosamente`

