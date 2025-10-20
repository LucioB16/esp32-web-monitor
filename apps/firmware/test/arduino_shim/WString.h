#pragma once

#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <string>

class String : public std::string {
 public:
  using std::string::string;

  int length() const { return static_cast<int>(size()); }
  bool isEmpty() const { return empty(); }

  void trim() {
    auto notSpace = [](unsigned char ch) { return !std::isspace(ch); };
    auto beginIt = std::find_if(begin(), end(), notSpace);
    auto endIt = std::find_if(rbegin(), rend(), notSpace).base();
    if (beginIt >= endIt) {
      clear();
      return;
    }
    std::string trimmed(beginIt, endIt);
    assign(trimmed);
  }

  int indexOf(char c, int from = 0) const {
    if (from < 0) {
      from = 0;
    }
    auto pos = find(c, static_cast<size_t>(from));
    return pos == npos ? -1 : static_cast<int>(pos);
  }

  int indexOf(const String &needle, int from = 0) const {
    if (from < 0) {
      from = 0;
    }
    auto pos = find(needle, static_cast<size_t>(from));
    return pos == npos ? -1 : static_cast<int>(pos);
  }

  String substring(int from) const {
    if (from < 0) {
      from = 0;
    }
    if (from >= length()) {
      return String();
    }
    return String(c_str() + from);
  }

  String substring(int from, int to) const {
    if (from < 0) {
      from = 0;
    }
    if (to < from) {
      to = from;
    }
    if (from >= length()) {
      return String();
    }
    size_t endIndex = static_cast<size_t>(std::min(to, length()));
    return String(data() + from, data() + endIndex);
  }

  bool startsWith(const char *prefix) const { return rfind(prefix, 0) == 0; }
  bool startsWith(const String &prefix) const { return rfind(prefix, 0) == 0; }

  bool endsWith(const String &suffix) const {
    if (suffix.length() > length()) {
      return false;
    }
    return compare(length() - suffix.length(), suffix.length(), suffix) == 0;
  }

  void remove(int index, int count) {
    if (index < 0) {
      index = 0;
    }
    if (count < 0) {
      count = 0;
    }
    if (index >= length()) {
      return;
    }
    erase(static_cast<size_t>(index), static_cast<size_t>(count));
  }

  void toLowerCase() {
    std::transform(begin(), end(), begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  }

  bool equalsIgnoreCase(const String &other) const {
    if (length() != other.length()) {
      return false;
    }
    for (size_t i = 0; i < length(); ++i) {
      if (std::tolower(static_cast<unsigned char>((*this)[i])) !=
          std::tolower(static_cast<unsigned char>(other[i]))) {
        return false;
      }
    }
    return true;
  }

  long toInt() const { return std::strtol(c_str(), nullptr, 10); }

  String &operator+=(char c) {
    push_back(c);
    return *this;
  }

  String &operator+=(const String &other) {
    append(other);
    return *this;
  }
};

inline String operator+(const String &lhs, const String &rhs) {
  String result(lhs);
  result += rhs;
  return result;
}

inline String operator+(const String &lhs, const char *rhs) {
  String result(lhs);
  result.append(rhs);
  return result;
}

inline String operator+(const char *lhs, const String &rhs) {
  String result(lhs);
  result += rhs;
  return result;
}
