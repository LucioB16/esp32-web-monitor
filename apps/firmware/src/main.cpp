#include <Arduino.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

#include <ContentExtractor.h>
#include <SecureHttpClient.h>
#include <StorageManager.h>
#include <algorithm>

#include "hmac_utils.h"
#include "site_record.h"

#ifndef WIFI_SSID
#error "Define WIFI_SSID via entorno (WIFI_SSID)"
#endif

#ifndef WIFI_PASS
#error "Define WIFI_PASS via entorno (WIFI_PASS)"
#endif

#ifndef MQTT_HOST_TLS
#error "Define MQTT_HOST_TLS via entorno"
#endif

#ifndef MQTT_PORT_TLS
#error "Define MQTT_PORT_TLS via entorno"
#endif

#ifndef DEVICE_ID
#error "Define DEVICE_ID via entorno"
#endif

#ifndef DEVICE_SECRET
#error "Define DEVICE_SECRET via entorno"
#endif

namespace {
constexpr uint16_t kMqttPort = MQTT_PORT_TLS;
const char *kWifiSsid = WIFI_SSID;
const char *kWifiPass = WIFI_PASS;
const char *kMqttHost = MQTT_HOST_TLS;
const char *kDeviceId = DEVICE_ID;
const std::string kDeviceSecret = DEVICE_SECRET;
WiFiClientSecure secureClient;
PubSubClient mqttClient(secureClient);
StorageManager storageManager;
SecureHttpClient httpClient;
SiteList sites;
String commandTopic;
String eventsTopic;
unsigned long lastReconnectAttempt = 0;

void logLine(const char *level, const String &message) {
  Serial.printf("[%s] %s\n", level, message.c_str());
}

SiteRecord *findSite(const String &id) {
  for (auto &record : sites) {
    if (record.config.id == id) {
      return &record;
    }
  }
  return nullptr;
}

String buildCanonicalCommand(const JsonDocument &doc) {
  StaticJsonDocument<2048> canonical;
  canonical["type"] = doc["type"];
  canonical["payload"] = doc["payload"];
  canonical["ts"] = doc["ts"];
  String serialized;
  serializeJson(canonical, serialized);
  return serialized;
}

void publishEvent(const char *type, const SiteRecord &record, int statusCode, size_t size, bool changed,
                  const String &excerpt, const String &errorMessage) {
  if (!mqttClient.connected()) {
    return;
  }
  StaticJsonDocument<1024> doc;
  doc["type"] = type;
  JsonObject payload = doc.createNestedObject("payload");
  payload["id"] = record.config.id;
  payload["http"] = statusCode;
  payload["size"] = static_cast<uint32_t>(size);
  payload["hash"] = record.state.lastHash;
  payload["changed"] = changed;
  payload["excerpt"] = excerpt;
  payload["error"] = errorMessage;
  doc["ts"] = static_cast<uint32_t>(millis() / 1000);
  String message;
  serializeJson(doc, message);
  mqttClient.publish(eventsTopic.c_str(), message.c_str(), false);
}

void persistSites() {
  if (!storageManager.saveSites(sites)) {
    logLine("WARN", "No se pudo persistir sitios en LittleFS");
  }
}

SiteRecord buildRecordFromPayload(JsonObject payload) {
  SiteRecord record;
  record.config.id = payload["id"].as<String>();
  record.config.url = payload["url"].as<String>();
  record.config.intervalSeconds = payload["interval_s"].as<uint32_t>();
  record.config.mode = payload["mode"].as<String>();
  record.config.selectorCss = payload["selector_css"].as<String>();
  record.config.startMarker = payload["start_marker"].as<String>();
  record.config.endMarker = payload["end_marker"].as<String>();
  record.config.regex = payload["regex"].as<String>();
  record.config.paused = payload["paused"].as<bool>();
  if (payload.containsKey("headers")) {
    JsonObject headers = payload["headers"].as<JsonObject>();
    for (JsonPair kv : headers) {
      record.config.headers[String(kv.key().c_str())] = kv.value().as<String>();
    }
  }
  return record;
}

String sanitizeExcerpt(const String &input) {
  String excerpt = input.substring(0, 120);
  excerpt.replace('\n', ' ');
  excerpt.replace('\r', ' ');
  return excerpt;
}

void performCheck(SiteRecord &record) {
  String body;
  int statusCode = -1;
  String errorMessage;
  bool fetched = httpClient.fetch(record.config, body, statusCode);
  String previousHash = record.state.lastHash;
  String excerptSource = body;
  bool extractionOk = false;
  if (!fetched) {
    errorMessage = F("Error HTTP");
    body = "";
  } else {
    ExtractionOutcome extraction = extractContentForSite(record.config, body);
    if (extraction.ok) {
      excerptSource = extraction.content;
      std::string extractedCopy(extraction.content.c_str(), extraction.content.length());
      record.state.lastHash = String(security::computeSha256Hex(extractedCopy).c_str());
      record.state.lastChanged = previousHash != record.state.lastHash;
      extractionOk = true;
    } else {
      errorMessage = extraction.errorMessage;
      record.state.lastHash = previousHash;
      record.state.lastChanged = false;
    }
  }
  if (!fetched) {
    record.state.lastHash = previousHash;
    record.state.lastChanged = false;
  }
  record.state.lastStatus = statusCode;
  record.state.lastSize = fetched ? body.length() : 0;
  persistSites();
  const bool success = fetched && extractionOk;
  const char *eventType = success ? (record.state.lastChanged ? "CHANGE_DETECTED" : "STATUS") : "ERROR";
  publishEvent(eventType, record, statusCode, body.length(), record.state.lastChanged,
               sanitizeExcerpt(excerptSource), errorMessage);
}

void handleUpsert(JsonObject payload) {
  SiteRecord incoming = buildRecordFromPayload(payload);
  if (incoming.config.id.isEmpty() || incoming.config.url.isEmpty()) {
    logLine("WARN", "Comando UPSERT_SITE incompleto");
    return;
  }
  if (incoming.config.intervalSeconds == 0) {
    incoming.config.intervalSeconds = 900;
  }
  if (incoming.config.mode.isEmpty()) {
    incoming.config.mode = "selector";
  }
  SiteRecord *existing = findSite(incoming.config.id);
  if (existing) {
    existing->config = incoming.config;
  } else {
    sites.push_back(incoming);
  }
  persistSites();
  logLine("INFO", String("Sitio actualizado: ") + incoming.config.id);
}

void handleDelete(const String &id) {
  auto it = std::remove_if(sites.begin(), sites.end(), [&](const SiteRecord &rec) { return rec.config.id == id; });
  if (it != sites.end()) {
    sites.erase(it, sites.end());
    persistSites();
    logLine("INFO", String("Sitio eliminado: ") + id);
  }
}

void handlePause(const String &id, bool paused) {
  SiteRecord *record = findSite(id);
  if (!record) {
    logLine("WARN", String("Sitio no encontrado para pausa: ") + id);
    return;
  }
  record->config.paused = paused;
  persistSites();
  logLine("INFO", String(paused ? "Pausa" : "Reanudar") + " sitio " + id);
}

void handleCheckNow(const String &id) {
  SiteRecord *record = findSite(id);
  if (!record) {
    logLine("WARN", String("CHECK_NOW sin sitio: ") + id);
    return;
  }
  performCheck(*record);
}

void handleCommand(char *payload, unsigned int length) {
  StaticJsonDocument<4096> doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    logLine("WARN", String("JSON inválido: ") + err.c_str());
    return;
  }
  const char *incomingHmac = doc["hmac"];
  if (!incomingHmac) {
    logLine("WARN", "Comando sin HMAC descartado");
    return;
  }

  String canonical = buildCanonicalCommand(doc);
  std::string computed;
  if (!security::computeHmacBase64(kDeviceSecret, canonical.c_str(), computed)) {
    logLine("ERROR", "No se pudo calcular HMAC local");
    return;
  }
  if (!security::constantTimeEquals(std::string(incomingHmac), computed)) {
    logLine("WARN", "HMAC inválido, comando rechazado");
    return;
  }

  const char *type = doc["type"] | "";
  JsonObject payloadObj = doc["payload"].as<JsonObject>();
  if (strcmp(type, "UPSERT_SITE") == 0) {
    handleUpsert(payloadObj);
  } else if (strcmp(type, "DELETE_SITE") == 0) {
    handleDelete(payloadObj["id"].as<String>());
  } else if (strcmp(type, "PAUSE_SITE") == 0) {
    handlePause(payloadObj["id"].as<String>(), true);
  } else if (strcmp(type, "RESUME_SITE") == 0) {
    handlePause(payloadObj["id"].as<String>(), false);
  } else if (strcmp(type, "CHECK_NOW") == 0) {
    handleCheckNow(payloadObj["id"].as<String>());
  } else {
    logLine("INFO", String("Comando desconocido: ") + type);
  }
}

bool ensureMqttConnected() {
  if (mqttClient.connected()) {
    return true;
  }
  unsigned long now = millis();
  if (now - lastReconnectAttempt < 2000) {
    return false;
  }
  lastReconnectAttempt = now;
  logLine("INFO", "Conectando a MQTT...");
  if (mqttClient.connect(kDeviceId, nullptr, nullptr)) {
    mqttClient.subscribe(commandTopic.c_str(), 1);
    logLine("INFO", String("Suscrito a ") + commandTopic);
    return true;
  }
  logLine("ERROR", String("Fallo al conectar MQTT: ") + mqttClient.state());
  return false;
}

void mqttCallback(char *topic, byte *payload, unsigned int length) {
  if (String(topic) != commandTopic) {
    return;
  }
  handleCommand(reinterpret_cast<char *>(payload), length);
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(kWifiSsid, kWifiPass);
  logLine("INFO", String("Conectando WiFi a ") + kWifiSsid);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
    if (millis() - start > 30000) {
      logLine("ERROR", "Timeout al conectar WiFi");
      start = millis();
    }
  }
  Serial.println();
  logLine("INFO", String("WiFi conectado, IP: ") + WiFi.localIP().toString());
}

void setupTopics() {
  const std::string suffix = security::deriveTopicSuffix(kDeviceId, kDeviceSecret);
  commandTopic = String("devices/") + kDeviceId + "-" + suffix.c_str() + "/commands";
  eventsTopic = String("devices/") + kDeviceId + "-" + suffix.c_str() + "/events";
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(200);
  logLine("INFO", "ESP32 Web Monitor — inicializando");

  connectWiFi();
  secureClient.setInsecure();  // TODO: cargar CA específica del broker
  mqttClient.setServer(kMqttHost, kMqttPort);
  mqttClient.setCallback(mqttCallback);
  setupTopics();

  if (!storageManager.begin()) {
    logLine("WARN", "No se pudo montar LittleFS");
  } else {
    if (!storageManager.loadSites(sites)) {
      logLine("WARN", "No se pudieron cargar sitios previos");
    } else {
      logLine("INFO", String("Sitios cargados: ") + sites.size());
    }
  }
}

void loop() {
  if (!mqttClient.connected()) {
    ensureMqttConnected();
  } else {
    mqttClient.loop();
  }
}
