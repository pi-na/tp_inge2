#!/bin/bash

# Script para configurar ngrok con Docker

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌐 Configuración de ngrok para Docker${NC}\n"

# Verificar que ngrok esté instalado
if ! command -v ngrok &> /dev/null; then
    echo -e "${RED}❌ ngrok no está instalado.${NC}"
    echo -e "   Instálalo con: ${GREEN}brew install ngrok${NC}\n"
    exit 1
fi

# Verificar que Docker esté corriendo
if ! docker-compose ps | grep -q frontend; then
    echo -e "${RED}❌ El frontend no está corriendo en Docker.${NC}"
    echo -e "   Inicia los servicios con: ${GREEN}docker-compose up -d${NC}\n"
    exit 1
fi

echo -e "${YELLOW}📋 Pasos:${NC}\n"

echo -e "${YELLOW}1. Inicia ngrok para el BACKEND (puerto 8000):${NC}"
echo -e "   ${GREEN}ngrok http 8000${NC}\n"
echo -e "   ${BLUE}Espera a que ngrok muestre la URL HTTPS...${NC}\n"

read -p "Ingresa la URL HTTPS del backend de ngrok (ej: https://xxxx-xx-xx-xx-xx.ngrok-free.app): " BACKEND_URL

if [ -z "$BACKEND_URL" ]; then
    echo -e "${RED}❌ URL no proporcionada${NC}\n"
    exit 1
fi

# Validar que sea una URL HTTPS
if [[ ! "$BACKEND_URL" =~ ^https:// ]]; then
    echo -e "${YELLOW}⚠️  La URL debe empezar con https://${NC}"
    echo -e "   Agregando https:// automáticamente...\n"
    BACKEND_URL="https://${BACKEND_URL}"
fi

echo -e "\n${BLUE}📝 Configurando VITE_API_URL=${BACKEND_URL}${NC}\n"

# Crear o actualizar .env
ENV_FILE="la-segunda-fe/.env"
if [ -f "$ENV_FILE" ]; then
    # Actualizar si ya existe
    if grep -q "VITE_API_URL=" "$ENV_FILE"; then
        sed -i.bak "s|VITE_API_URL=.*|VITE_API_URL=${BACKEND_URL}|" "$ENV_FILE"
        echo -e "${GREEN}✓ Actualizado ${ENV_FILE}${NC}"
    else
        echo "VITE_API_URL=${BACKEND_URL}" >> "$ENV_FILE"
        echo -e "${GREEN}✓ Agregado a ${ENV_FILE}${NC}"
    fi
else
    echo "VITE_API_URL=${BACKEND_URL}" > "$ENV_FILE"
    echo -e "${GREEN}✓ Creado ${ENV_FILE}${NC}"
fi

echo -e "\n${BLUE}🔄 Reconstruyendo y reiniciando frontend para aplicar cambios...${NC}\n"

# Crear un archivo .env en la raíz del proyecto para docker-compose
ROOT_ENV_FILE=".env"
if [ -f "$ROOT_ENV_FILE" ]; then
    if grep -q "VITE_API_URL=" "$ROOT_ENV_FILE"; then
        sed -i.bak "s|VITE_API_URL=.*|VITE_API_URL=${BACKEND_URL}|" "$ROOT_ENV_FILE"
    else
        echo "VITE_API_URL=${BACKEND_URL}" >> "$ROOT_ENV_FILE"
    fi
else
    echo "VITE_API_URL=${BACKEND_URL}" > "$ROOT_ENV_FILE"
fi

# Reconstruir el frontend con la nueva variable
export VITE_API_URL="${BACKEND_URL}"
docker-compose build frontend
docker-compose up -d frontend

echo -e "\n${GREEN}✅ Configuración completada!${NC}\n"
echo -e "${BLUE}📍 Próximos pasos:${NC}\n"
echo -e "${YELLOW}1. Inicia ngrok para el FRONTEND (puerto 5173):${NC}"
echo -e "   ${GREEN}ngrok http 5173${NC}\n"
echo -e "${YELLOW}2. Usa la URL de ngrok del frontend en tu celular${NC}\n"
echo -e "${BLUE}💡 El frontend ahora usará: ${BACKEND_URL}${NC}\n"

