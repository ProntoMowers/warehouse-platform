# Ship Pricing Center API Reference

Base local:

```text
http://localhost:3012
```

## Autenticacion

Los endpoints privados aceptan una API key en cualquiera de estos headers:

```http
x-api-key: TU_API_KEY
```

```http
Authorization: Bearer TU_API_KEY
```

Variables soportadas:

- `API_KEY`
- `API_KEYS` (separadas por coma)
- `PARTS_AVAILABILITY_API_KEY`

## Respuestas

Exito:

```json
{ "ok": true }
```

Error:

```json
{ "ok": false, "message": "Descripcion del error" }
```

## Endpoints publicos

### GET `/api/health`

Verifica que el backend esta vivo.

```powershell
curl.exe "http://localhost:3012/api/health"
```

## Endpoints privados

### GET `/api/ping`

Verifica autenticacion por API key.

### GET `/api/databases/status`

Valida conectividad a MySQL, SQL Server y BigQuery. Si BigQuery no tiene credenciales configuradas, responde `skipped`.

### GET `/api/orders`

Lista ordenes con filtros y paginacion.

Parametros comunes:

- `date_from`
- `date_to`
- `page`
- `per_page`
- `store`
- `cause`
- `search`

### GET `/api/orders/summary`

Resumen de ventas, costos, shipping y margen para el periodo.

### GET `/api/orders/:artransid/lines`

Lineas de producto de una orden.

### GET `/api/orders/:artransid/shipping`

Shipments asociados por `sw_order_num`.

### PUT `/api/orders/:artransid/cause`

Asigna o limpia una causa manual para una orden.

Body:

```json
{ "cause": "Shipping overcharge" }
```

### PUT `/api/orders/:artransid/solution`

Asigna o limpia una solucion manual para una orden.

Body:

```json
{ "solution": "Ajustar shipping charge" }
```

### GET `/api/causes`

Opciones de causa y asignaciones existentes.

### PUT `/api/causes/options`

Actualiza opciones de causa.

### GET `/api/solutions`

Opciones de solucion y asignaciones existentes.

### PUT `/api/solutions/options`

Actualiza opciones de solucion.

### GET `/api/segments`

Agrupa ordenes asignadas por causa e incluye la solucion guardada por orden.

### GET `/api/skus`

Analitica por SKU.

### GET `/api/skus/orders`

Ordenes relacionadas a un SKU.

### GET `/api/shipping-rules`

Lista reglas de shipping.

### POST `/api/shipping-rules`

Crea una regla.

### PUT `/api/shipping-rules/:rule_id`

Actualiza una regla.

### DELETE `/api/shipping-rules/:rule_id`

Elimina una regla.

### GET `/api/shipping-map`

Devuelve reglas por estado para mapa.

### GET `/api/shipping-analysis`

Analisis de shipping contra reglas.

### GET `/api/stores/timeline`

Serie temporal por tienda.

### GET `/api/stores/analytics`

Analitica comparativa por tienda.
