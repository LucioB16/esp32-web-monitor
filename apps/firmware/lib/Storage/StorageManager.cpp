#include "StorageManager.h"

#include <ArduinoJson.h>

bool StorageManager::begin() {
  if (!LittleFS.begin(true)) {
    return false;
  }
  return true;
}

String StorageManager::readFile(const String &path) {
  File file = LittleFS.open(path, "r");
  if (!file) {
    return {};
  }
  String content = file.readString();
  file.close();
  return content;
}

bool StorageManager::writeToFile(const String &path, const String &content) {
  File file = LittleFS.open(path, "w");
  if (!file) {
    return false;
  }
  file.print(content);
  file.close();
  return true;
}

bool StorageManager::loadSites(SiteList &outSites) {
  outSites.clear();
  const String raw = readFile(kSitesFile);
  if (raw.isEmpty()) {
    return true;
  }

  DynamicJsonDocument doc(8192);
  DeserializationError err = deserializeJson(doc, raw);
  if (err) {
    return false;
  }

  JsonArray array = doc.as<JsonArray>();
  for (JsonObject item : array) {
    SiteRecord record;
    record.config.id = item["id"].as<String>();
    record.config.url = item["url"].as<String>();
    record.config.intervalSeconds = item["interval_s"].as<uint32_t>();
    record.config.mode = item["mode"].as<String>();
    record.config.selectorCss = item["selector_css"].as<String>();
    record.config.startMarker = item["start_marker"].as<String>();
    record.config.endMarker = item["end_marker"].as<String>();
    record.config.regex = item["regex"].as<String>();
    record.config.paused = item["paused"].as<bool>();
    if (item.containsKey("headers")) {
      JsonObject headers = item["headers"].as<JsonObject>();
      for (JsonPair kv : headers) {
        record.config.headers[String(kv.key().c_str())] = kv.value().as<String>();
      }
    }
    record.state.lastHash = item["state"]["hash"].as<String>();
    record.state.lastStatus = item["state"]["http"].as<uint32_t>();
    record.state.lastSize = item["state"]["size"].as<uint32_t>();
    record.state.lastChanged = item["state"]["changed"].as<bool>();
    outSites.push_back(record);
  }
  return true;
}

bool StorageManager::saveSites(const SiteList &sites) {
  DynamicJsonDocument doc(8192);
  JsonArray array = doc.to<JsonArray>();
  for (const auto &record : sites) {
    JsonObject item = array.createNestedObject();
    item["id"] = record.config.id;
    item["url"] = record.config.url;
    item["interval_s"] = record.config.intervalSeconds;
    item["mode"] = record.config.mode;
    item["selector_css"] = record.config.selectorCss;
    item["start_marker"] = record.config.startMarker;
    item["end_marker"] = record.config.endMarker;
    item["regex"] = record.config.regex;
    item["paused"] = record.config.paused;
    JsonObject headers = item.createNestedObject("headers");
    for (const auto &kv : record.config.headers) {
      headers[kv.first] = kv.second;
    }
    JsonObject state = item.createNestedObject("state");
    state["hash"] = record.state.lastHash;
    state["http"] = record.state.lastStatus;
    state["size"] = record.state.lastSize;
    state["changed"] = record.state.lastChanged;
  }

  String serialized;
  serializeJson(doc, serialized);
  return writeToFile(kSitesFile, serialized);
}
