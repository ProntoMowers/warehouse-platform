# Copilot Instructions — picking-app frontend

## Objetivo
Frontend en React + TypeScript para consumir el backend de `picking-app` de forma segura y consistente.

## Stack y convenciones
- React + TypeScript.
- Mantener componentes de UI separados de lógica de datos.
- Acceso a API centralizado (no repetir `fetch` en múltiples componentes).

## Estructura recomendada para API
- `src/api/client.ts`: cliente HTTP base.
- `src/api/endpoints.ts`: funciones por endpoint.
- `src/types/api.ts`: tipos de respuestas.
- `src/hooks/*`: hooks para consumo de datos en pantallas.

## Reglas para generar código
1. No hardcodear URL ni API keys en componentes.
2. Leer configuración desde variables `VITE_*`.
3. Incluir headers comunes en un único cliente (`Content-Type`, `x-api-key`).
4. Manejar estados de carga y error en UI.
5. Estandarizar respuestas esperadas (`ok`, `message`, `timestamp`).
6. No exponer secretos reales en commits ni logs.

## Variables de entorno frontend
- `VITE_API_BASE_URL` (ejemplo: `http://localhost:3001`)
- `VITE_API_KEY` (solo para entorno interno/controlado)

## Endpoints backend actuales
- Público: `GET /api/health`
- Privados:
  - `GET /api/ping`
  - `GET /api/databases/status`

## Patrón de implementación sugerido
- Crear función por endpoint en `src/api/endpoints.ts`.
- Usar esas funciones desde hooks/páginas.
- Evitar llamadas directas desde JSX salvo casos mínimos.

## Criterios de calidad
- Código pequeño y legible.
- Reutilizable entre pantallas.
- Sin romper estilos de la plantilla.
- Errores mostrados al usuario de forma clara.
