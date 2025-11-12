#!/bin/bash

# Script para levantar backend, frontend y ngrok
# Uso: ./start-dev.sh

set -e  # Salir si hay errores

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Iniciando entorno de desarrollo...${NC}\n"

# Función para limpiar procesos al salir
cleanup() {
    echo -e "\n${YELLOW}🛑 Deteniendo procesos...${NC}"
    kill $BACKEND_PID $FRONTEND_PID $NGROK_PID 2>/dev/null || true
    exit
}

trap cleanup SIGINT SIGTERM

# 1. Detectar IP local
echo -e "${BLUE}📡 Detectando IP local...${NC}"
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - buscar IP en interfaces activas
    # Primero intentar encontrar IPs privadas comunes
    LOCAL_IP=$(ifconfig | grep -E "inet (192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)" | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
    # Si no encuentra, buscar cualquier IP que no sea localhost
    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    LOCAL_IP=$(hostname -I | awk '{print $1}')
else
    echo "Sistema operativo no soportado"
    exit 1
fi

if [ -z "$LOCAL_IP" ]; then
    echo -e "${YELLOW}⚠️  No se pudo detectar IP local. Usando localhost.${NC}"
    LOCAL_IP="localhost"
else
    echo -e "${GREEN}✓ IP local detectada: ${LOCAL_IP}${NC}"
fi

# 2. Configurar VITE_API_URL
export VITE_API_URL="http://${LOCAL_IP}:8000"
echo -e "${GREEN}✓ VITE_API_URL=${VITE_API_URL}${NC}\n"

# 3. Verificar que ngrok esté instalado
if ! command -v ngrok &> /dev/null; then
    echo -e "${YELLOW}⚠️  ngrok no está instalado. Instálalo con: brew install ngrok${NC}"
    echo -e "${YELLOW}   Continuando sin ngrok...${NC}\n"
    USE_NGROK=false
else
    USE_NGROK=true
    echo -e "${GREEN}✓ ngrok encontrado${NC}\n"
fi

# 4. Iniciar backend
echo -e "${BLUE}🔧 Iniciando backend en puerto 8000...${NC}"
cd "$(dirname "$0")"
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend iniciado (PID: $BACKEND_PID)${NC}"
sleep 2  # Esperar a que el backend inicie

# 5. Iniciar frontend
echo -e "${BLUE}🎨 Iniciando frontend en puerto 5173...${NC}"
cd la-segunda-fe
npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend iniciado (PID: $FRONTEND_PID)${NC}"
sleep 3  # Esperar a que el frontend inicie

# 6. Iniciar ngrok para el frontend
if [ "$USE_NGROK" = true ]; then
    echo -e "${BLUE}🌐 Iniciando ngrok para frontend (puerto 5173)...${NC}"
    ngrok http 5173 > /tmp/ngrok.log 2>&1 &
    NGROK_PID=$!
    sleep 4  # Esperar a que ngrok inicie
    
    # Intentar obtener la URL de ngrok desde la API local (múltiples intentos)
    NGROK_URL=""
    for i in {1..5}; do
        sleep 1
        NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
        if [ -n "$NGROK_URL" ]; then
            break
        fi
    done
    
    if [ -n "$NGROK_URL" ]; then
        echo -e "${GREEN}✓ Ngrok iniciado${NC}"
        echo -e "${GREEN}🌍 URL pública del frontend: ${NGROK_URL}${NC}"
        echo -e "${YELLOW}⚠️  Si usas ngrok para el backend, actualiza VITE_API_URL en .env${NC}"
    else
        echo -e "${YELLOW}⚠️  Ngrok iniciado. Revisa la URL en: http://localhost:4040${NC}"
        echo -e "${YELLOW}   O ejecuta: ngrok http 5173 (en otra terminal)${NC}"
    fi
fi

echo -e "\n${GREEN}✅ Todo listo!${NC}\n"
echo -e "${BLUE}📍 URLs disponibles:${NC}"
echo -e "   Backend:  http://${LOCAL_IP}:8000"
echo -e "   Frontend: http://${LOCAL_IP}:5173"
if [ "$USE_NGROK" = true ] && [ -n "$NGROK_URL" ]; then
    echo -e "   Frontend (ngrok): ${NGROK_URL}"
fi
echo -e "\n${YELLOW}💡 Para detener todo, presiona Ctrl+C${NC}\n"

# Mantener el script corriendo
wait

