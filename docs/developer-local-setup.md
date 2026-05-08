# Guía para desarrolladores: clonar, instalar y probar localmente

Este documento explica cómo preparar el proyecto **warehouse-platform** en una máquina local para trabajar sobre **picking-app**.

## Requisitos

- Windows 10/11
- Git
- Node.js 20 o superior
- PowerShell

## Estructura relevante

- Frontend: `apps/picking-app/frontend`
- Backend: `apps/picking-app/backend`

## 1) Clonar el repositorio

Abrir PowerShell como administrador y ejecutar:

```powershell
cd C:\inetpub
git clone https://github.com/ProntoMowers/warehouse-platform.git
cd C:\inetpub\warehouse-platform
```

Si ya existe la carpeta, actualizarla:

```powershell
cd C:\inetpub\warehouse-platform
git pull origin main
```

## 2) Instalar dependencias

### Backend

```powershell
cd C:\inetpub\warehouse-platform\apps\picking-app\backend
npm ci
```

### Frontend

```powershell
cd C:\inetpub\warehouse-platform\apps\picking-app\frontend
npm ci
```

> Recomendación: usar `npm ci` cuando ya existe `package-lock.json`.

## 3) Configurar variables de entorno

### Backend

Crear o editar `C:\inetpub\warehouse-platform\apps\picking-app\backend\.env`.

Ejemplo:

```env
PORT=3001
API_KEY=tu-clave-segura
CORS_ORIGIN=http://localhost:5173
```

### Frontend

Crear o editar `C:\inetpub\warehouse-platform\apps\picking-app\frontend\.env`.

Ejemplo:

```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_API_KEY=tu-clave-segura
```

## 4) Levantar todo con un solo comando

Existe un script que arranca backend y frontend juntos. Ejecutar desde PowerShell:

```powershell
cd C:\inetpub\warehouse-platform\apps\picking-app
.\start-dev.ps1
```

Esto inicia:
- Backend en `http://localhost:3001`
- Frontend en `http://localhost:5173`
- Verifica que ambos puertos estén escuchando

Si prefiere arrancarlos por separado, ver las secciones siguientes.

## 5) Ejecutar el backend

En una terminal:

```powershell
cd C:\inetpub\warehouse-platform\apps\picking-app\backend
npm run dev
```

El backend normalmente queda disponible en:

- `http://localhost:3001`

## 5) Ejecutar el frontend

En otra terminal:

```powershell
cd C:\inetpub\warehouse-platform\apps\picking-app\frontend
npm run dev
```

El frontend normalmente queda disponible en:

- `http://localhost:5173`

## 6) Pruebas locales

### Verificación básica del backend

Probar que responde el endpoint de salud:

- `GET http://localhost:3001/api/health`

### Verificación del frontend

Abrir el navegador en:

- `http://localhost:5173`

Y validar la página de estado de picking:

- `/picking/status`

## 7) Compilación de verificación

### Backend

No tiene build, pero se puede validar iniciando el servidor:

```powershell
npm run start
```

### Frontend

Compilar para validar que no hay errores de TypeScript o Vite:

```powershell
cd C:\inetpub\warehouse-platform\apps\picking-app\frontend
npm run build
```

La compilación genera la carpeta:

- `C:\inetpub\warehouse-platform\apps\picking-app\frontend\dist`

## 8) Flujo de trabajo recomendado

1. Clonar o actualizar el repo
2. Instalar dependencias con `npm ci`
3. Configurar `.env` en backend y frontend
4. Ejecutar backend con `npm run dev`
5. Ejecutar frontend con `npm run dev`
6. Revisar `/api/health` y `/picking/status`
7. Antes de subir cambios, correr `npm run build` en frontend

## 9) Notas importantes

- La carpeta `dist` no se versiona en Git; se genera con `npm run build`.
- Si cambia el backend o el frontend, repetir la compilación o reiniciar el servidor local.
- Si el backend requiere credenciales de base de datos, deben configurarse en su `.env`.

## 10) Comandos rápidos

### Iniciar backend

```powershell
cd C:\inetpub\warehouse-platform\apps\picking-app\backend
npm run dev
```

### Iniciar frontend

```powershell
cd C:\inetpub\warehouse-platform\apps\picking-app\frontend
npm run dev
```

### Compilar frontend

```powershell
cd C:\inetpub\warehouse-platform\apps\picking-app\frontend
npm run build
```

### Actualizar repo

```powershell
cd C:\inetpub\warehouse-platform
git pull origin main
```
