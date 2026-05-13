# Copilot Instructions - ship-pricing-center backend

## Objetivo del proyecto
Backend de `ship-pricing-center` en Node.js + Express para analisis de ordenes, margen, shipping y reglas de pricing. Mantiene seguridad basica por API key y conectividad a Pronto MySQL, ShipWorks SQL Server y BigQuery.

## Stack y convenciones
- Runtime: Node.js (CommonJS, `require/module.exports`).
- Framework HTTP: Express.
- Configuracion: variables de entorno con `dotenv`.
- Seguridad: middleware `apiKeyAuth`.
- Estilo: cambios pequenos, sin refactor innecesario.

## Estructura que debes respetar
- `src/server.js`: bootstrap del servidor y registro de rutas.
- `src/routes/*.routes.js`: definicion de endpoints.
- `src/controllers/*.controller.js`: manejo de request/response.
- `src/services/*.service.js`: logica de negocio e integracion.
- `src/middleware/*.js`: seguridad y middlewares comunes.
- `data/*.json`: reglas y asignaciones mutables; no sobrescribir data real en deploy.

## Reglas para generar codigo
1. Mantener separacion por capas (`routes -> controllers -> services`).
2. No exponer secretos ni credenciales en codigo o logs.
3. No editar `.env` real; usar `.env.example` para nuevas variables.
4. Todos los endpoints privados deben pasar por `apiKeyAuth`.
5. Respuestas JSON consistentes:
   - exito: `{ ok: true, ... }`
   - error: `{ ok: false, message: string }`
6. Usar `async/await` y manejo de errores explicito.
7. Evitar dependencias nuevas si no son necesarias.

## API Key
- Headers validos:
  - `x-api-key: <key>`
  - `Authorization: Bearer <key>`
- Variables soportadas:
  - `API_KEY`
  - `API_KEYS` (separadas por coma)
  - `PARTS_AVAILABILITY_API_KEY`

## Endpoints actuales
- Publico: `GET /api/health`
- Privados:
  - `GET /api/ping`
  - `GET /api/databases/status`
  - `GET /api/orders`, `GET /api/orders/summary`
  - `GET /api/orders/:artransid/lines`
  - `GET /api/orders/:artransid/shipping`
  - `PUT /api/orders/:artransid/cause`
  - `GET /api/causes`, `PUT /api/causes/options`
  - `GET /api/segments`
  - `GET /api/skus`, `GET /api/skus/orders`
  - `GET/POST/PUT/DELETE /api/shipping-rules`
  - `GET /api/shipping-map`, `GET /api/shipping-analysis`
  - `GET /api/stores/timeline`, `GET /api/stores/analytics`

## Que hacer al agregar un endpoint nuevo
1. Crear ruta en `src/routes`.
2. Crear/actualizar controlador en `src/controllers`.
3. Implementar logica en `src/services`.
4. Si requiere BD, reutilizar servicios existentes.
5. Documentar en `docs/api-endpoints-reference.md`.

## Criterios de calidad
- Codigo legible y consistente con archivos existentes.
- Sin romper endpoints actuales.
- Sin hardcodear rutas externas o secretos.
- Mantener mensajes de error claros para cliente API.
