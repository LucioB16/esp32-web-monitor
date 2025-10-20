#pragma once

#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

#include "site_record.h"

class SecureHttpClient {
 public:
  bool fetch(const SiteConfig &config, String &body, int &statusCode);

 private:
  WiFiClientSecure client_;
};
