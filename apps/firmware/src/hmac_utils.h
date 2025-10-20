#pragma once

#include <Arduino.h>
#include <string>

namespace security {

std::string deriveTopicSuffix(const std::string &deviceId, const std::string &secret);

bool computeHmacBase64(const std::string &secret, const std::string &message, std::string &outBase64);

bool constantTimeEquals(const std::string &a, const std::string &b);

std::string computeSha256Hex(const std::string &input);

}
