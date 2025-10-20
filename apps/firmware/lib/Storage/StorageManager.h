#pragma once

#include <Arduino.h>
#include <LittleFS.h>

#include "site_record.h"

class StorageManager {
 public:
  bool begin();
  bool loadSites(SiteList &outSites);
  bool saveSites(const SiteList &sites);

 private:
  static constexpr const char *kSitesFile = "/sites.json";
  bool writeToFile(const String &path, const String &content);
  String readFile(const String &path);
};
