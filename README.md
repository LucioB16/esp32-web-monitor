# ESP32 Web Monitor

Monitoreo de cambios web extremo a extremo con ESP32, MQTT público, Nuxt 3 desplegado en Vercel (preset serverless/edge) y alertas por Telegram, todo aprovechando planes gratuitos.

## Visión general
- **Firmware ESP32**: captura HTML de sitios, calcula hashes/recortes y publica eventos vía MQTT TLS.
- **Backend + UI (Nuxt 3/Nitro)**: administra sitios, sirve helper visual para selectores y expone APIs (incluyendo webhook Telegram) listo para Vercel.
- **Contratos JSON**: esquemas documentados para comandos y eventos MQTT.
- **Infra scripts**: validaciones rápidas para asegurar compilaciones en cada commit.

## Arquitectura
```
.
├─ apps/
│  ├─ web/           # Nuxt 3 + Nitro (preset Vercel)
│  └─ firmware/      # PlatformIO/Arduino para ESP32
├─ contracts/        # JSON Schema + ejemplos
├─ scripts/          # utilidades locales (lint/build/tests)
├─ .editorconfig
├─ LICENSE
└─ README.md
```

### Flujo de datos
1. **UI** permite crear/editar sitios de monitoreo y publica comandos MQTT (`devices/{DEVICE_ID}-{RAND}/commands`) vía WSS.
2. **ESP32** recibe comandos, valida HMAC (`DEVICE_SECRET`), descarga la página, extrae información y publica eventos (`devices/{DEVICE_ID}-{RAND}/events`).
3. **Nuxt API** persiste configuración (Redis Serverless gratuito vía Vercel Marketplace, con fallback en memoria), sirve helper de selectores y procesa webhooks de Telegram.
4. **Telegram Bot** entrega notificaciones al chat configurado (`TELEGRAM_CHAT_ID`).

## Variables de entorno
Todas deben existir tanto en desarrollo como en producción.

| Variable | Descripción |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Token del bot Telegram que enviará mensajes. |
| `TELEGRAM_CHAT_ID` | ID numérico del chat/grupo destino. |
| `TELEGRAM_WEBHOOK_SECRET` | Segmento secreto del endpoint `/api/telegram/webhook/:secret`. |
| `MQTT_URL_WSS` | URL WSS del broker MQTT público (por ejemplo `wss://test.mosquitto.org:8081/mqtt`). |
| `MQTT_HOST_TLS` | Host TLS para el firmware (ej. `test.mosquitto.org`). |
| `MQTT_PORT_TLS` | Puerto TLS (ej. `8883`). |
| `DEVICE_ID` | Identificador del dispositivo ESP32. |
| `DEVICE_SECRET` | Secreto HMAC compartido entre firmware y backend. |
| `NUXT_PUBLIC_MQTT_URL_WSS` | URL MQTT WSS expuesta al navegador (igual que `MQTT_URL_WSS`). |
| `REDIS_URL` | Cadena de conexión única de Redis Serverless (Marketplace de Vercel). |
| `WIFI_SSID` / `WIFI_PASS` | **Opcional**: solo definir en entorno local para el firmware (no commitear). |

> Si `REDIS_URL` no está definido, las APIs usarán un almacenamiento en memoria efímero (solo válido para pruebas locales).

## Guía rápida de desarrollo
1. Clonar el repo y exportar las variables anteriores (`direnv` recomendado).
2. Ejecutar `./scripts/dev-check.sh` para validar estado.
3. `apps/web`: `npm install` (o gestor equivalente) y `npm run dev` para iniciar la UI.
4. `apps/firmware`: abrir con PlatformIO y configurar WiFi vía variables de entorno locales.

## Despliegue en Vercel
1. Crear un proyecto en [Vercel](https://vercel.com/) y seleccionar este repositorio.
2. En **Root Directory** indicar `apps/web` (monorepo) y mantener el comando de build por defecto (`npm ci && npm run build`).
3. Instalar la integración **Redis Serverless** desde el Marketplace y enlazarla al proyecto; copia la `REDIS_URL` proporcionada.
4. Definir todas las variables de entorno listadas arriba (`REDIS_URL` incluida) y desplegar.
5. Configurar el webhook del bot Telegram apuntando a `https://<tu-app>.vercel.app/api/telegram/webhook/${TELEGRAM_WEBHOOK_SECRET}`.

## Planes gratuitos y advertencias
- **Broker MQTT**: se utiliza Mosquitto público sin garantías; no habilita mensajes retenidos. Ajustar intervalos para evitar rate limit.
- **Vercel**: desplegar como serverless/edge, el preset `vercel` genera automáticamente `.vercel/output` para los builds.
- **Telegram Bot API**: seguir términos de uso y evitar spam. El bot debe ser agregado explícitamente al chat destino.
- **Scraping web**: verifica `robots.txt`, términos de servicio y legalidad antes de monitorear un sitio.

## Próximos pasos
- Implementar Nuxt 3 con preset Vercel y estado global.
- Desarrollar API MQTT, webhook de Telegram y helper visual.
- Construir firmware ESP32 con MQTT TLS, hashing y extracción por selectores/regex.
- Añadir contratos JSON y tests automáticos.

## Licencia
MIT. Ver [LICENSE](LICENSE).
