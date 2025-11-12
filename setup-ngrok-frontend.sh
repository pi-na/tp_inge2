#!/bin/bash

# Script para configurar ngrok para el frontend y backend

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌐 Configuración de ngrok para La Segunda${NC}\n"

# Verificar que ngrok esté instalado
if ! command -v ngrok &> /dev/null; then
    echo -e "${YELLOW}⚠️  ngrok no está instalado.${NC}"
    echo -e "   Instálalo con: ${GREEN}brew install ngrok${NC}"
    echo -e "   O descárgalo de: https://ngrok.com/download\n"
    exit 1
fi

echo -e "${GREEN}✓ ngrok encontrado${NC}\n"

# Verificar que Docker esté corriendo
if ! docker-compose ps | grep -q frontend; then
    echo -e "${YELLOW}⚠️  El frontend no está corriendo en Docker.${NC}"
    echo -e "   Inicia los servicios con: ${GREEN}docker-compose up -d${NC}\n"
    exit 1
fi

echo -e "${BLUE}📋 Pasos para configurar ngrok:${NC}\n"

echo -e "${YELLOW}1. Inicia ngrok para el FRONTEND (puerto 5173):${NC}"
echo -e "   ${GREEN}ngrok http 5173${NC}"
echo -e "   Copia la URL HTTPS que te muestra (ej: https://xxxx-xx-xx-xx-xx.ngrok-free.app)\n"

echo -e "${YELLOW}2. (Opcional) Si quieres usar ngrok también para el BACKEND:${NC}"
echo -e "   En otra terminal, ejecuta: ${GREEN}ngrok http 8000${NC}"
echo -e "   Copia la URL HTTPS del backend\n"

echo -e "${YELLOW}3. Si configuraste ngrok para el backend, actualiza el .env:${NC}"
echo -e "   Edita ${GREEN}la-segunda-fe/.env${NC} y agrega:"
echo -e "   ${GREEN}VITE_API_URL=https://tu-backend-ngrok.ngrok-free.app${NC}\n"

echo -e "${YELLOW}4. Reinicia el frontend:${NC}"
echo -e "   ${GREEN}docker-compose restart frontend${NC}\n"

echo -e "${YELLOW}5. Accede desde tu celular:${NC}"
echo -e "   Usa la URL de ngrok del frontend en tu navegador móvil\n"

echo -e "${BLUE}💡 Tip:${NC} Si solo quieres acceder desde la misma red WiFi,"
echo -e "   puedes usar tu IP local en lugar de ngrok:"
echo -e "   ${GREEN}http://TU_IP:5173${NC} (ej: http://192.168.1.96:5173)\n"

