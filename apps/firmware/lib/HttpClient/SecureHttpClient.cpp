#include "SecureHttpClient.h"

bool SecureHttpClient::fetch(const SiteConfig &config, String &body, int &statusCode) {
  HTTPClient http;
  client_.setInsecure();
  if (!http.begin(client_, config.url)) {
    return false;
  }
  http.setTimeout(8000);
  for (const auto &kv : config.headers) {
    http.addHeader(kv.first, kv.second);
  }
  statusCode = http.GET();
  if (statusCode <= 0) {
    http.end();
    return false;
  }
  body = http.getString();
  http.end();
  return true;
}
