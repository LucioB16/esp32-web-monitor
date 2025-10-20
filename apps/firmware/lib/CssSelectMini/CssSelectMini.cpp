#include "CssSelectMini.h"

#include <cctype>
#include <map>

namespace {
String trimCopy(String value) {
  value.trim();
  return value;
}

void splitClasses(const String &value, std::vector<String> &out) {
  int start = 0;
  while (start < value.length()) {
    while (start < value.length() && isspace(static_cast<unsigned char>(value[start]))) {
      ++start;
    }
    if (start >= value.length()) {
      break;
    }
    int end = start;
    while (end < value.length() && !isspace(static_cast<unsigned char>(value[end]))) {
      ++end;
    }
    String token = value.substring(start, end);
    token.trim();
    if (!token.isEmpty()) {
      token.toLowerCase();
      out.push_back(token);
    }
    start = end;
  }
}
}  // namespace

bool CssSelectMini::selectInnerText(const String &html, const String &selector, String &outText) const {
  SelectorQuery query;
  if (!parseSelector(selector, query)) {
    return false;
  }
  return extractByQuery(html, query, outText);
}

String CssSelectMini::toLowerCopy(const String &value) const {
  String result = value;
  result.toLowerCase();
  return result;
}

bool CssSelectMini::parseSelector(const String &selector, SelectorQuery &query) const {
  String working = trimCopy(selector);
  if (working.isEmpty()) {
    return false;
  }
  int nthIdx = working.indexOf(F(":nth-of-type("));
  if (nthIdx >= 0) {
    int closeIdx = working.indexOf(')', nthIdx);
    if (closeIdx > nthIdx) {
      String number = working.substring(nthIdx + 13, closeIdx);
      number.trim();
      query.nthOfType = number.toInt();
      working.remove(nthIdx, closeIdx - nthIdx + 1);
    }
  }

  int i = 0;
  while (i < working.length()) {
    char c = working[i];
    if (c == '#') {
      int start = ++i;
      while (i < working.length() && working[i] != '.' && working[i] != '#') {
        ++i;
      }
      query.id = working.substring(start, i);
      query.id.trim();
    } else if (c == '.') {
      int start = ++i;
      while (i < working.length() && working[i] != '.' && working[i] != '#') {
        ++i;
      }
      String cls = working.substring(start, i);
      cls.trim();
      if (!cls.isEmpty()) {
        cls.toLowerCase();
        query.classes.push_back(cls);
      }
    } else if (!isspace(c)) {
      int start = i;
      while (i < working.length() && working[i] != '.' && working[i] != '#' && !isspace(working[i])) {
        ++i;
      }
      query.tag = working.substring(start, i);
      query.tag.trim();
    } else {
      ++i;
    }
  }

  query.tag = toLowerCopy(query.tag);
  query.id = toLowerCopy(query.id);
  for (auto &cls : query.classes) {
    cls.toLowerCase();
  }
  return !(query.tag.isEmpty() && query.id.isEmpty() && query.classes.empty());
}

bool CssSelectMini::matches(const SelectorQuery &query, const String &tag, const String &id,
                            const std::vector<String> &classes, int nthOfType) const {
  if (!query.tag.isEmpty() && query.tag != tag) {
    return false;
  }
  if (!query.id.isEmpty() && query.id != id) {
    return false;
  }
  for (const auto &cls : query.classes) {
    bool found = false;
    for (const auto &candidate : classes) {
      if (cls == candidate) {
        found = true;
        break;
      }
    }
    if (!found) {
      return false;
    }
  }
  if (query.nthOfType > 0 && nthOfType != query.nthOfType) {
    return false;
  }
  return true;
}

bool CssSelectMini::extractByQuery(const String &html, const SelectorQuery &query, String &outText) const {
  std::vector<std::map<String, int>> typeCounters;
  typeCounters.emplace_back();
  size_t pos = 0;
  std::vector<String> tagStack;

  while (true) {
    int open = html.indexOf('<', pos);
    if (open < 0) {
      break;
    }
    int close = html.indexOf('>', open + 1);
    if (close < 0) {
      break;
    }
    String tagContent = html.substring(open + 1, close);
    if (tagContent.startsWith("/")) {
      if (!tagStack.empty()) {
        tagStack.pop_back();
      }
      if (typeCounters.size() > 1) {
        typeCounters.pop_back();
      }
      pos = close + 1;
      continue;
    }
    if (tagContent.startsWith("!") || tagContent.startsWith("?")) {
      pos = close + 1;
      continue;
    }
    bool selfClosing = false;
    if (tagContent.endsWith("/")) {
      selfClosing = true;
      tagContent.remove(tagContent.length() - 1);
    }
    tagContent.trim();
    int idx = 0;
    String tagName;
    while (idx < tagContent.length() && !isspace(tagContent[idx])) {
      tagName += tagContent[idx++];
    }
    tagName = toLowerCopy(tagName);

    std::vector<String> classes;
    String elementId;
    while (idx < tagContent.length()) {
      while (idx < tagContent.length() && isspace(tagContent[idx])) {
        ++idx;
      }
      if (idx >= tagContent.length()) {
        break;
      }
      int equal = tagContent.indexOf('=', idx);
      if (equal < 0) {
        break;
      }
      String key = tagContent.substring(idx, equal);
      key.trim();
      idx = equal + 1;
      if (idx >= tagContent.length()) {
        break;
      }
      char quote = tagContent[idx];
      if (quote == '\"' || quote == '\'') {
        ++idx;
        int endQuote = tagContent.indexOf(quote, idx);
        if (endQuote < 0) {
          break;
        }
        String value = tagContent.substring(idx, endQuote);
        idx = endQuote + 1;
        if (key.equalsIgnoreCase("id")) {
          elementId = value;
        } else if (key.equalsIgnoreCase("class")) {
          splitClasses(value, classes);
        }
      } else {
        while (idx < tagContent.length() && !isspace(tagContent[idx])) {
          ++idx;
        }
      }
    }

    elementId = toLowerCopy(elementId);
    int nth = ++typeCounters.back()[tagName];
    if (!selfClosing) {
      typeCounters.emplace_back();
      tagStack.push_back(tagName);
    }

    if (matches(query, tagName, elementId, classes, nth)) {
      size_t contentStart = close + 1;
      if (selfClosing) {
        outText = "";
        return true;
      }
      size_t search = contentStart;
      int depth = 1;
      while (search < static_cast<size_t>(html.length())) {
        int next = html.indexOf('<', search);
        if (next < 0) {
          break;
        }
        if (next + 1 < html.length() && html[next + 1] == '/') {
          int closingEnd = html.indexOf('>', next + 2);
          if (closingEnd < 0) {
            break;
          }
          String closingName = html.substring(next + 2, closingEnd);
          closingName = toLowerCopy(trimCopy(closingName));
          if (closingName == tagName) {
            --depth;
            if (depth == 0) {
              outText = trimCopy(html.substring(contentStart, next));
              return true;
            }
          }
          search = closingEnd + 1;
        } else if (next + 1 < html.length() && html[next + 1] != '!' && html[next + 1] != '?') {
          int childEnd = html.indexOf('>', next + 1);
          if (childEnd < 0) {
            break;
          }
          depth++;
          search = childEnd + 1;
        } else {
          int skipEnd = html.indexOf('>', next + 1);
          if (skipEnd < 0) {
            break;
          }
          search = skipEnd + 1;
        }
      }
    }
    pos = close + 1;
  }
  return false;
}
