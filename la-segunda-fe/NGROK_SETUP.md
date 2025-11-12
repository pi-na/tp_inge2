# Configuración con Ngrok

## Instalación de Ngrok

1. Descarga ngrok desde https://ngrok.com/download
2. O instala con Homebrew: `brew install ngrok`
3. Crea una cuenta gratuita en https://dashboard.ngrok.com/get-started/your-authtoken

## Configuración paso a paso

### 1. Autentica ngrok con tu token:
```bash
ngrok config add-authtoken TU_TOKEN_AQUI
```

### 2. Inicia el backend FastAPI (en una terminal):
```bash
cd /Users/tomaspinausig/code/tp_inge2
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Inicia ngrok apuntando al puerto 8000 (en otra terminal):
```bash
ngrok http 8000
```

Ngrok te mostrará algo como:
```
Forwarding  https://xxxx-xx-xx-xx-xx.ngrok-free.app -> http://localhost:8000
```

### 4. Configura la variable de entorno en el frontend:

Crea un archivo `.env` en `la-segunda-fe/` (si no existe):
```bash
cd la-segunda-fe
touch .env
```

Agrega esta línea al archivo `.env`:
```
VITE_API_URL=https://xxxx-xx-xx-xx-xx.ngrok-free.app
```

**Reemplaza `xxxx-xx-xx-xx-xx` con la URL que te dio ngrok.**

### 5. Reinicia el servidor de desarrollo de Vite:
```bash
npm run dev
```

### 6. Accede desde tu celular:

- Opción A: Usa ngrok también para el frontend (recomendado)
  - En otra terminal, ejecuta: `ngrok http 5173`
  - Usa la URL de ngrok del frontend en tu celular

- Opción B: Usa tu IP local para el frontend
  - Encuentra tu IP: `ifconfig | grep "inet " | grep -v 127.0.0.1` (Mac)
  - Accede desde el celular: `http://TU_IP:5173`
  - El frontend automáticamente usará la URL de ngrok configurada en `.env`

## Nota importante sobre URLs de ngrok gratuitas

⚠️ **Las URLs de ngrok gratuitas cambian cada vez que reinicias ngrok.**

Cada vez que reinicies ngrok, deberás:
1. Copiar la nueva URL
2. Actualizar el archivo `.env` con la nueva URL
3. Reiniciar el servidor de Vite (`npm run dev`)

Si quieres una URL fija, necesitas una cuenta de pago de ngrok.

## Alternativa: Usar solo IP local (sin ngrok)

Si estás en la misma red WiFi, puedes usar tu IP local sin ngrok:

1. Encuentra tu IP local:
   - Mac/Linux: `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - Windows: `ipconfig` (busca "IPv4 Address")

2. Inicia el backend con:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

3. El frontend automáticamente detectará la IP local y usará `http://TU_IP:8000`

4. Accede desde el celular: `http://TU_IP:5173`

**Ventaja**: No necesitas configurar nada, funciona automáticamente.
**Desventaja**: Solo funciona en la misma red WiFi.

