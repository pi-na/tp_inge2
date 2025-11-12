#!/bin/bash
# Script para configurar ngrok para el backend y actualizar el .env del frontend

echo "🔧 Configuración de ngrok para backend y frontend"
echo ""

# Verificar que ngrok esté instalado
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok no está instalado. Instálalo con: brew install ngrok"
    exit 1
fi

echo "📋 Pasos:"
echo "1. Inicia ngrok para el backend en otra terminal:"
echo "   ngrok http 8000"
echo ""
echo "2. Copia la URL HTTPS que te muestra (ej: https://xxxx-xx-xx-xx-xx.ngrok-free.app)"
echo ""
read -p "Pega la URL del backend en ngrok: " BACKEND_NGROK_URL

if [ -z "$BACKEND_NGROK_URL" ]; then
    echo "❌ URL vacía. Abortando."
    exit 1
fi

# Validar que sea una URL HTTPS
if [[ ! "$BACKEND_NGROK_URL" =~ ^https:// ]]; then
    echo "⚠️  La URL debe empezar con https://. Agregándolo..."
    BACKEND_NGROK_URL="https://${BACKEND_NGROK_URL}"
fi

# Escribir al .env
echo "VITE_API_URL=${BACKEND_NGROK_URL}" > la-segunda-fe/.env
echo ""
echo "✅ Configurado! la-segunda-fe/.env ahora tiene:"
echo "   VITE_API_URL=${BACKEND_NGROK_URL}"
echo ""
echo "🔄 Reinicia el frontend para que tome los cambios:"
echo "   cd la-segunda-fe && npm run dev"
echo ""
echo "📱 Ahora puedes acceder desde el celular al ngrok del frontend y funcionará!"

