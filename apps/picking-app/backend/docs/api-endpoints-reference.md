# Referencia de Endpoints — picking-app backend

Base URL por defecto (local):
- `http://localhost:3001`

Prefijo API:
- `/api`

---

## Autenticación por API Key
Los endpoints privados requieren una API key válida.

Puedes enviarla de una de estas formas:

1) Header `x-api-key`

```http
x-api-key: TU_API_KEY
```

2) Header `Authorization` como Bearer

```http
Authorization: Bearer TU_API_KEY
```

Si la key no existe o es inválida, la API responde:
- Status: `401`
- Body:

```json
{
  "ok": false,
  "message": "Unauthorized. Provide a valid API key in x-api-key or Bearer token."
}
```

---

## 1) Health check (público)

### GET `/api/health`
Valida que el servicio está vivo.

#### Ejemplo de request
```bash
curl -X GET "http://localhost:3001/api/health"
```

#### Respuesta esperada
- Status: `200`
- Body:

```json
{
  "ok": true,
  "service": "picking-app-backend",
  "timestamp": "2026-05-08T12:00:00.000Z",
  "uptimeSeconds": 123
}
```

---

## 2) Ping seguro (privado)

### GET `/api/ping`
Confirma acceso a endpoint protegido.

#### Ejemplo de request
```bash
curl -X GET "http://localhost:3001/api/ping" \
  -H "x-api-key: TU_API_KEY"
```

#### Respuesta esperada
- Status: `200`
- Body:

```json
{
  "ok": true,
  "message": "Secure endpoint reachable.",
  "timestamp": "2026-05-08T12:00:00.000Z"
}
```

---

## 3) Estado de bases de datos (privado)

### GET `/api/databases/status`
Prueba conectividad a:
- MySQL
- SQL Server
- MongoDB
- Firebird
- PostgreSQL

#### Ejemplo de request
```bash
curl -X GET "http://localhost:3001/api/databases/status" \
  -H "Authorization: Bearer TU_API_KEY"
```

#### Respuesta esperada (todo OK)
- Status: `200`

```json
{
  "ok": true,
  "timestamp": "2026-05-08T12:00:00.000Z",
  "databases": {
    "mysql": { "status": "ok" },
    "mssql": { "status": "ok" },
    "mongodb": { "status": "ok" },
    "firebird": { "status": "ok" },
    "postgres": { "status": "ok" }
  }
}
```

#### Respuesta con errores parciales
- Status: `207`

```json
{
  "ok": false,
  "timestamp": "2026-05-08T12:00:00.000Z",
  "databases": {
    "mysql": { "status": "ok" },
    "mssql": { "status": "error", "message": "..." },
    "mongodb": { "status": "ok" },
    "firebird": { "status": "skipped", "message": "Missing env vars: ..." },
    "postgres": { "status": "ok" }
  }
}
```

---

## Códigos de estado usados
- `200`: request exitoso.
- `207`: éxito parcial (algunas conexiones fallaron o se omitieron).
- `401`: API key inválida o ausente.
- `404`: ruta no encontrada.
- `500`: error interno del servidor.

---

## Variables de entorno importantes
Revisar y completar:
- `.env` (local, no versionar)
- `.env.example` (plantilla)

Para API key:
- `API_KEY` o `API_KEYS`
- (también se acepta `PARTS_AVAILABILITY_API_KEY`)

---

## Ubicación del código fuente de endpoints
- Rutas: `src/routes/health.routes.js`, `src/routes/secure.routes.js`
- Controladores: `src/controllers/health.controller.js`, `src/controllers/database.controller.js`
- Seguridad: `src/middleware/apiKeyAuth.js`
- Servicio de conexiones: `src/services/database.service.js`
