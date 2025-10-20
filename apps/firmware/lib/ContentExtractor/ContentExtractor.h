#pragma once

#include <Arduino.h>

#include "site_record.h"

struct ExtractionOutcome {
  bool ok = false;
  String content;
  String errorMessage;
};

ExtractionOutcome extractContentForSite(const SiteConfig &config, const String &body);
