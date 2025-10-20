# ESP32 Web Monitor

Monitoreo de cambios web extremo a extremo con ESP32, MQTT público, Nuxt 3 desplegado en Deno Deploy y alertas por Telegram, todo aprovechando planes gratuitos.

## Visión general
- **Firmware ESP32**: captura HTML de sitios, calcula hashes/recortes y publica eventos vía MQTT TLS.
- **Backend + UI (Nuxt 3/Nitro)**: administra sitios, sirve helper visual para selectores y expone APIs (incluyendo webhook Telegram) listo para Deno Deploy.
- **Contratos JSON**: esquemas documentados para comandos y eventos MQTT.
- **Infra scripts**: validaciones rápidas para asegurar compilaciones en cada commit.

## Arquitectura
```
.
├─ apps/
│  ├─ web/           # Nuxt 3 + Nitro (preset Deno Deploy)
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
3. **Nuxt API** persiste configuración (Deno KV opcional), sirve helper de selectores y procesa webhooks de Telegram.
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
| `USE_DENO_KV` | `true` para persistir sitios en Deno KV (recomendado en Deno Deploy). |
| `WIFI_SSID` / `WIFI_PASS` | **Opcional**: solo definir en entorno local para el firmware (no commitear). |

## Guía rápida de desarrollo
1. Clonar el repo y exportar las variables anteriores (`direnv` recomendado).
2. Ejecutar `./scripts/dev-check.sh` para validar estado.
3. `apps/web`: `pnpm install` y `pnpm dev` (o `npm`/`yarn`) según preferencia.
4. `apps/firmware`: abrir con PlatformIO y configurar WiFi vía variables de entorno locales.

## Despliegue en Deno Deploy
1. Crear proyecto en [Deno Deploy](https://dash.deno.com/).
2. Conectar el repositorio y seleccionar `apps/web` como raíz.
3. Establecer preset `deno` en `nuxt.config.ts` (se proporcionará) y definir todas las variables de entorno.
4. Habilitar Deno KV si está disponible; de lo contrario, el backend caerá automáticamente a almacenamiento en memoria.
5. Configurar el webhook del bot Telegram apuntando a `https://<tu-app>.deno.dev/api/telegram/webhook/${TELEGRAM_WEBHOOK_SECRET}`.

## Planes gratuitos y advertencias
- **Broker MQTT**: se utiliza Mosquitto público sin garantías; no habilita mensajes retenidos. Ajustar intervalos para evitar rate limit.
- **Deno Deploy**: respetar límites de CPU/memoria del plan gratuito; evitar scraping agresivo.
- **Telegram Bot API**: seguir términos de uso y evitar spam. El bot debe ser agregado explícitamente al chat destino.
- **Scraping web**: verifica `robots.txt`, términos de servicio y legalidad antes de monitorear un sitio.

## Próximos pasos
- Implementar Nuxt 3 con preset Deno y estado global.
- Desarrollar API MQTT, webhook de Telegram y helper visual.
- Construir firmware ESP32 con MQTT TLS, hashing y extracción por selectores/regex.
- Añadir contratos JSON y tests automáticos.

## Licencia
MIT. Ver [LICENSE](LICENSE).
