# Frontend - Referencia para consumir la API de ship-pricing-center

Esta guia explica como referenciar endpoints del backend desde el frontend.

## 1) Variables de entorno (Vite)

Crear archivo `.env` local en el frontend:

```env
VITE_API_BASE_URL=http://localhost:3012
VITE_API_KEY=TU_API_KEY
```

Nota: `VITE_*` queda disponible en el cliente. No usar llaves sensibles de produccion en frontend publico.

## 2) Cliente centralizado

La configuracion y headers comunes viven en:

- `src/api/client.ts`

Funciones por endpoint viven en:

- `src/api/endpoints.ts`

Tipos compartidos viven en:

- `src/types/api.ts`

## 3) Headers requeridos

Para endpoints privados enviar API key:

- `x-api-key: ${import.meta.env.VITE_API_KEY}`

o

- `Authorization: Bearer ${import.meta.env.VITE_API_KEY}`

## 4) Endpoints principales

- Health publico: `GET /api/health`
- Ping privado: `GET /api/ping`
- Estado de bases: `GET /api/databases/status`
- Ordenes: `GET /api/orders`
- Soluciones: `GET /api/solutions`
- Analisis shipping: `GET /api/shipping-analysis`
- Analitica stores: `GET /api/stores/analytics`

## 5) Patron recomendado

```ts
import { getDatabasesStatus } from './api/endpoints';

const status = await getDatabasesStatus();
```

Evitar `fetch` directo en componentes React. Si se agregan pantallas nuevas, crear funciones en `src/api/endpoints.ts` y tipos en `src/types/api.ts`.

## 6) Dashboard estatico

El dashboard heredado esta en `public/ship-pricing.html`. El wrapper React escribe `shipPricingApiBaseUrl` y `shipPricingApiKey` en `localStorage` para que el dashboard use la misma configuracion sin poner la key en el URL del iframe.

## 7) Prueba rapida local

1. Iniciar backend en `http://localhost:3012`.
2. Iniciar frontend en `http://localhost:5174`.
3. Abrir `http://localhost:5174`.
4. Verificar backend:

```powershell
Invoke-WebRequest http://localhost:3012/api/health
```
