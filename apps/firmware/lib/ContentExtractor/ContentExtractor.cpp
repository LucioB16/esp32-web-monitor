#include "ContentExtractor.h"

#include <regex>
#include <string>

#include <CssSelectMini.h>

namespace {
String trimmedCopy(String value) {
  value.trim();
  return value;
}

String lowerCopy(String value) {
  value.toLowerCase();
  return value;
}

ExtractionOutcome extractBySelector(const SiteConfig &config, const String &body) {
  ExtractionOutcome outcome;
  if (config.selectorCss.isEmpty()) {
    outcome.errorMessage = F("selector_css vacío");
    return outcome;
  }
  CssSelectMini css;
  String extracted;
  if (!css.selectInnerText(body, config.selectorCss, extracted)) {
    outcome.errorMessage = F("Selector sin coincidencias");
    return outcome;
  }
  outcome.ok = true;
  outcome.content = trimmedCopy(extracted);
  return outcome;
}

ExtractionOutcome extractByMarkers(const SiteConfig &config, const String &body) {
  ExtractionOutcome outcome;
  if (config.startMarker.isEmpty()) {
    outcome.errorMessage = F("start_marker vacío");
    return outcome;
  }
  int startIdx = body.indexOf(config.startMarker);
  if (startIdx < 0) {
    outcome.errorMessage = F("No se encontró start_marker");
    return outcome;
  }
  startIdx += config.startMarker.length();
  int endIdx = config.endMarker.isEmpty() ? body.length() : body.indexOf(config.endMarker, startIdx);
  if (!config.endMarker.isEmpty() && endIdx < 0) {
    outcome.errorMessage = F("No se encontró end_marker");
    return outcome;
  }
  String extracted = body.substring(startIdx, endIdx);
  outcome.ok = true;
  outcome.content = trimmedCopy(extracted);
  return outcome;
}

ExtractionOutcome extractByRegex(const SiteConfig &config, const String &body) {
  ExtractionOutcome outcome;
  if (config.regex.isEmpty()) {
    outcome.errorMessage = F("regex vacío");
    return outcome;
  }
  try {
    std::regex re(config.regex.c_str(), std::regex::ECMAScript);
    std::smatch match;
    std::string input(body.c_str());
    if (!std::regex_search(input, match, re)) {
      outcome.errorMessage = F("Regex sin coincidencias");
      return outcome;
    }
    std::string selected;
    if (match.size() > 1) {
      selected = match[1].str();
    } else {
      selected = match[0].str();
    }
    outcome.ok = true;
    outcome.content = trimmedCopy(String(selected.c_str()));
    return outcome;
  } catch (const std::regex_error &err) {
    outcome.errorMessage = String(F("Regex inválida: ")) + err.what();
    return outcome;
  }
}

}  // namespace

ExtractionOutcome extractContentForSite(const SiteConfig &config, const String &body) {
  String mode = lowerCopy(config.mode);
  if (mode == F("full")) {
    ExtractionOutcome outcome;
    outcome.ok = true;
    outcome.content = body;
    return outcome;
  }
  if (mode == F("selector") || mode.isEmpty()) {
    return extractBySelector(config, body);
  }
  if (mode == F("markers")) {
    return extractByMarkers(config, body);
  }
  if (mode == F("regex")) {
    return extractByRegex(config, body);
  }
  ExtractionOutcome outcome;
  outcome.errorMessage = String(F("Modo desconocido: ")) + mode;
  return outcome;
}
