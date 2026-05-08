# Frontend — Referencia para consumir la API de picking-app

Esta guía explica cómo referenciar endpoints del backend desde el frontend.

## 1) Variables de entorno (Vite)
Crear archivo `.env` local en el frontend:

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_API_KEY=TU_API_KEY
```

> Nota: `VITE_*` queda disponible en el cliente. No usar llaves sensibles de producción en frontend público.

---

## 2) Construcción de URL de endpoint
Base URL:
- `import.meta.env.VITE_API_BASE_URL`

Endpoints:
- Health (público): `${baseUrl}/api/health`
- Ping (privado): `${baseUrl}/api/ping`
- Databases status (privado): `${baseUrl}/api/databases/status`

---

## 3) Headers requeridos
Para endpoints privados enviar API key:

- `x-api-key: ${import.meta.env.VITE_API_KEY}`

o

- `Authorization: Bearer ${import.meta.env.VITE_API_KEY}`

---

## 4) Ejemplo mínimo con fetch

```ts
const baseUrl = import.meta.env.VITE_API_BASE_URL;
const apiKey = import.meta.env.VITE_API_KEY;

export async function getHealth() {
  const res = await fetch(`${baseUrl}/api/health`);
  if (!res.ok) throw new Error(`Health failed: ${res.status}`);
  return res.json();
}

export async function getSecurePing() {
  const res = await fetch(`${baseUrl}/api/ping`, {
    headers: {
      'x-api-key': apiKey,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Ping failed: ${res.status}`);
  }

  return res.json();
}

export async function getDatabasesStatus() {
  const res = await fetch(`${baseUrl}/api/databases/status`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  // 200 (ok total) o 207 (ok parcial)
  if (!(res.status === 200 || res.status === 207)) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Databases status failed: ${res.status}`);
  }

  return res.json();
}
```

---

## 5) Manejo recomendado de errores en UI
- `401`: mostrar “API key inválida o ausente”.
- `404`: endpoint no existe.
- `500`: error interno del backend.
- `207`: mostrar detalle por motor de base de datos (`ok/error/skipped`).

---

## 6) Checklist rápido
- `VITE_API_BASE_URL` correcto.
- `VITE_API_KEY` cargada.
- Backend arriba en puerto configurado.
- CORS habilitado en backend (ya habilitado actualmente).

---

## 7) Prueba rápida local (smoke test)

1. Iniciar backend (`apps/picking-app/backend`) para exponer `http://localhost:3001`.
2. En frontend (`apps/picking-app/frontend`), crear `.env` basado en `.env.example`.
3. Instalar dependencias y levantar Vite:

```bash
npm install
npm run dev
```

4. Abrir en navegador la URL mostrada por Vite (por defecto `http://localhost:5173`).
5. En pantalla verás **Picking App — API Smoke Test** con 3 botones:
  - `Probar /api/health`
  - `Probar /api/ping`
  - `Probar /api/databases/status`

Si todo está bien, cada botón mostrará JSON de respuesta en pantalla.
