# Copilot Instructions - ship-pricing-center frontend

## Objetivo
Frontend en React + TypeScript que monta el dashboard de `ship-pricing-center` y consume el backend de forma consistente.

## Stack y convenciones
- React + TypeScript + Vite.
- Mantener componentes de UI separados de logica de datos.
- Acceso a API centralizado (no repetir `fetch` en multiples componentes).
- El dashboard estatico en `public/ship-pricing.html` debe recibir su configuracion desde el wrapper React.

## Estructura recomendada para API
- `src/api/client.ts`: cliente HTTP base y configuracion runtime.
- `src/api/endpoints.ts`: funciones por endpoint.
- `src/types/api.ts`: tipos de respuestas.
- `src/hooks/*`: hooks para consumo de datos en pantallas, si se agregan pantallas React.

## Reglas para generar codigo
1. No hardcodear URL ni API keys en componentes.
2. Leer configuracion desde variables `VITE_*`.
3. Incluir headers comunes en un unico cliente (`Content-Type`, `x-api-key`).
4. Manejar estados de carga y error en UI.
5. Estandarizar respuestas esperadas (`ok`, `message`, `timestamp`).
6. No exponer secretos reales en commits ni logs.

## Variables de entorno frontend
- `VITE_API_BASE_URL` (ejemplo: `http://localhost:3012`)
- `VITE_API_KEY` (solo para entorno interno/controlado)

## Endpoints backend actuales
- Publico: `GET /api/health`
- Privados:
  - `GET /api/ping`
  - `GET /api/databases/status`
  - `GET /api/orders`
  - `GET /api/shipping-analysis`
  - `GET /api/stores/analytics`

## Patron de implementacion sugerido
- Crear funcion por endpoint en `src/api/endpoints.ts`.
- Usar esas funciones desde hooks/paginas.
- Evitar llamadas directas desde JSX salvo casos minimos.

## Criterios de calidad
- Codigo pequeno y legible.
- Reutilizable entre pantallas.
- Sin romper estilos de la plantilla.
- Errores mostrados al usuario de forma clara.
