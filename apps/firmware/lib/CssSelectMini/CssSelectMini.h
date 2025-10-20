#pragma once

#include <Arduino.h>
#include <vector>

class CssSelectMini {
 public:
  bool selectInnerText(const String &html, const String &selector, String &outText) const;

 private:
  struct SelectorQuery {
    String tag;
    String id;
    std::vector<String> classes;
    int nthOfType = -1;
  };

  bool parseSelector(const String &selector, SelectorQuery &query) const;
  bool matches(const SelectorQuery &query, const String &tag, const String &id,
               const std::vector<String> &classes, int nthOfType) const;
  bool extractByQuery(const String &html, const SelectorQuery &query, String &outText) const;
  String toLowerCopy(const String &value) const;
};
