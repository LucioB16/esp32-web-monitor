#include "hmac_utils.h"

#include <mbedtls/base64.h>
#include <mbedtls/md.h>
#include <mbedtls/sha256.h>

namespace security {

std::string deriveTopicSuffix(const std::string &deviceId, const std::string &secret) {
  std::string input = deviceId + ":" + secret;
  unsigned char hash[32];
  mbedtls_sha256_context ctx;
  mbedtls_sha256_init(&ctx);
  mbedtls_sha256_starts_ret(&ctx, 0);
  mbedtls_sha256_update_ret(&ctx, reinterpret_cast<const unsigned char *>(input.data()), input.size());
  mbedtls_sha256_finish_ret(&ctx, hash);
  mbedtls_sha256_free(&ctx);

  char hex[65] = {0};
  for (size_t i = 0; i < sizeof(hash); ++i) {
    std::snprintf(hex + (i * 2), 3, "%02x", hash[i]);
  }
  return std::string(hex, hex + 10);
}

bool computeHmacBase64(const std::string &secret, const std::string &message, std::string &outBase64) {
  const mbedtls_md_info_t *info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (!info) {
    return false;
  }

  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  if (mbedtls_md_setup(&ctx, info, 1) != 0) {
    mbedtls_md_free(&ctx);
    return false;
  }

  if (mbedtls_md_hmac_starts(&ctx, reinterpret_cast<const unsigned char *>(secret.data()), secret.size()) != 0) {
    mbedtls_md_free(&ctx);
    return false;
  }
  if (mbedtls_md_hmac_update(&ctx, reinterpret_cast<const unsigned char *>(message.data()), message.size()) != 0) {
    mbedtls_md_free(&ctx);
    return false;
  }
  unsigned char result[32];
  if (mbedtls_md_hmac_finish(&ctx, result) != 0) {
    mbedtls_md_free(&ctx);
    return false;
  }
  mbedtls_md_free(&ctx);

  unsigned char output[128];
  size_t outputLen = 0;
  if (mbedtls_base64_encode(output, sizeof(output), &outputLen, result, sizeof(result)) != 0) {
    return false;
  }
  outBase64.assign(reinterpret_cast<char *>(output), outputLen);
  return true;
}

bool constantTimeEquals(const std::string &a, const std::string &b) {
  if (a.size() != b.size()) {
    return false;
  }
  unsigned char diff = 0;
  for (size_t i = 0; i < a.size(); ++i) {
    diff |= static_cast<unsigned char>(a[i] ^ b[i]);
  }
  return diff == 0;
}

std::string computeSha256Hex(const std::string &input) {
  unsigned char hash[32];
  mbedtls_sha256_context ctx;
  mbedtls_sha256_init(&ctx);
  mbedtls_sha256_starts_ret(&ctx, 0);
  mbedtls_sha256_update_ret(&ctx, reinterpret_cast<const unsigned char *>(input.data()), input.size());
  mbedtls_sha256_finish_ret(&ctx, hash);
  mbedtls_sha256_free(&ctx);

  char hex[65] = {0};
  for (size_t i = 0; i < sizeof(hash); ++i) {
    std::snprintf(hex + (i * 2), 3, "%02x", hash[i]);
  }
  return std::string(hex);
}

}  // namespace security
