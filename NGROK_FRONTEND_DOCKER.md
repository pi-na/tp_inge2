# Acceder al Frontend desde ngrok (con Docker)

## Pasos rápidos

### 1. Verificar que el frontend esté corriendo

```bash
docker-compose ps
```

Deberías ver `la_segunda_frontend` corriendo en el puerto 5173.

### 2. Iniciar ngrok para el frontend

En una terminal nueva, ejecuta:

```bash
ngrok http 5173
```

Ngrok te mostrará algo como:
```
Forwarding  https://xxxx-xx-xx-xx-xx.ngrok-free.app -> http://localhost:5173
```

**Copia la URL HTTPS** (la que empieza con `https://`)

### 3. (Opcional) Si también quieres usar ngrok para el backend

Si quieres acceder desde el celular y evitar problemas de Mixed Content:

#### 3a. Inicia ngrok para el backend (en otra terminal):

```bash
ngrok http 8000
```

Copia la URL HTTPS del backend (ej: `https://yyyy-yy-yy-yy-yy.ngrok-free.app`)

#### 3b. Configura el frontend para usar el backend de ngrok:

Edita `la-segunda-fe/.env` (o créalo si no existe):

```bash
VITE_API_URL=https://yyyy-yy-yy-yy-yy.ngrok-free.app
```

**Reemplaza `yyyy-yy-yy-yy-yy` con la URL que te dio ngrok del backend.**

#### 3c. Reinicia el contenedor del frontend:

```bash
docker-compose restart frontend
```

### 4. Accede desde tu celular

Abre en tu celular la URL de ngrok del frontend:
```
https://xxxx-xx-xx-xx-xx.ngrok-free.app
```

## Resumen de URLs

- **Frontend (ngrok)**: `https://xxxx-xx-xx-xx-xx.ngrok-free.app` (la que te dio ngrok del puerto 5173)
- **Backend (ngrok)**: `https://yyyy-yy-yy-yy-yy.ngrok-free.app` (si configuraste ngrok para el backend)
- **Backend (local)**: `http://localhost:8000` (si no usas ngrok para el backend)

## Notas importantes

⚠️ **Las URLs de ngrok gratuitas cambian cada vez que reinicias ngrok.**

Si reinicias ngrok:
1. Copia la nueva URL
2. Si usas ngrok para el backend, actualiza `la-segunda-fe/.env` con la nueva URL
3. Reinicia el frontend: `docker-compose restart frontend`

## Verificar que funciona

1. Abre la consola del navegador en tu celular (Chrome DevTools remoto o Safari Web Inspector)
2. Deberías ver en los logs:
   ```
   🔗 API URL configurada: https://yyyy-yy-yy-yy-yy.ngrok-free.app
   ```
3. Las requests deberían funcionar correctamente

## Alternativa: Solo IP local (sin ngrok)

Si estás en la misma red WiFi que tu celular:

1. **No uses ngrok para el frontend**
2. Encuentra tu IP local:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
3. Accede desde el celular: `http://TU_IP:5173` (ej: `http://192.168.1.96:5173`)
4. El código detectará automáticamente la IP local y usará `http://TU_IP:8000` para el backend

**Ventaja**: No necesitas configurar nada  
**Desventaja**: Solo funciona en la misma red WiFi

