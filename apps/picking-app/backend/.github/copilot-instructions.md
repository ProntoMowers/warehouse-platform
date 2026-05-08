# Copilot Instructions — picking-app backend

## Objetivo del proyecto
Backend de `picking-app` en Node.js + Express para operaciones de bodega, con seguridad básica por API key y conectividad a múltiples motores de base de datos.

## Stack y convenciones
- Runtime: Node.js (CommonJS, `require/module.exports`).
- Framework HTTP: Express.
- Configuración: variables de entorno con `dotenv`.
- Seguridad: middleware `apiKeyAuth`.
- Estilo: cambios pequeños, sin refactor innecesario.

## Estructura que debes respetar
- `src/server.js`: bootstrap del servidor y registro de rutas.
- `src/routes/*.routes.js`: definición de endpoints.
- `src/controllers/*.controller.js`: manejo de request/response.
- `src/services/*.service.js`: lógica de negocio e integración.
- `src/config/db.*.js`: clientes y helpers de conexión a BD.
- `src/middleware/*.js`: seguridad y middlewares comunes.

## Reglas para generar código
1. Mantener separación por capas (`routes -> controllers -> services`).
2. No exponer secretos ni credenciales en código o logs.
3. No editar `.env` real; usar `.env.example` para nuevas variables.
4. Todos los endpoints privados deben pasar por `apiKeyAuth`.
5. Respuestas JSON consistentes:
   - éxito: `{ ok: true, ... }`
   - error: `{ ok: false, message: string }`
6. Usar `async/await` y manejo de errores explícito.
7. Evitar dependencias nuevas si no son necesarias.

## API Key
- Headers válidos:
  - `x-api-key: <key>`
  - `Authorization: Bearer <key>`
- Variables soportadas:
  - `API_KEY`
  - `API_KEYS` (separadas por coma)
  - `PARTS_AVAILABILITY_API_KEY`

## Endpoints actuales
- Público: `GET /api/health`
- Privados:
  - `GET /api/ping`
  - `GET /api/databases/status`

## Qué hacer al agregar un endpoint nuevo
1. Crear ruta en `src/routes`.
2. Crear/actualizar controlador en `src/controllers`.
3. Implementar lógica en `src/services`.
4. Si requiere BD, reutilizar conectores de `src/config`.
5. Documentar en `docs/api-endpoints-reference.md`.

## Criterios de calidad
- Código legible y consistente con archivos existentes.
- Sin romper endpoints actuales.
- Sin hardcodear rutas externas o secretos.
- Mantener mensajes de error claros para cliente API.
