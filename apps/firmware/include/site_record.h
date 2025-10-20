#pragma once

#include <Arduino.h>
#include <map>
#include <vector>

struct SiteConfig {
  String id;
  String url;
  uint32_t intervalSeconds = 900;
  String mode = "selector";
  String selectorCss;
  String startMarker;
  String endMarker;
  String regex;
  std::map<String, String> headers;
  bool paused = false;
};

struct SiteState {
  String lastHash;
  uint32_t lastStatus = 0;
  size_t lastSize = 0;
  bool lastChanged = false;
};

struct SiteRecord {
  SiteConfig config;
  SiteState state;
};

using SiteList = std::vector<SiteRecord>;
