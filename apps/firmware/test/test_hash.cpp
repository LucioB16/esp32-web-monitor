#include <unity.h>

#include "../src/hmac_utils.h"

void test_topic_suffix() {
  const std::string suffix = security::deriveTopicSuffix("device-demo", "secret-demo");
  TEST_ASSERT_EQUAL_STRING_LEN("49dbd99f86", suffix.c_str(), 10);
}

void test_hmac_base64() {
  std::string output;
  bool ok = security::computeHmacBase64("secret", "{\"type\":\"PING\"}", output);
  TEST_ASSERT_TRUE(ok);
  TEST_ASSERT_EQUAL_STRING("lK/PYiNu93NMKfEgsBA6awVTpQ1pHl3/CAcP1byx6r0=", output.c_str());
  TEST_ASSERT_TRUE(security::constantTimeEquals(output, output));
}

void test_sha256_hex() {
  std::string hex = security::computeSha256Hex("hola mundo");
  TEST_ASSERT_EQUAL_STRING("0b894166d3336435c800bea36ff21b29eaa801a52f584c006c49289a0dcf6e2f", hex.c_str());
}

int main(int, char **) {
  UNITY_BEGIN();
  RUN_TEST(test_topic_suffix);
  RUN_TEST(test_hmac_base64);
  RUN_TEST(test_sha256_hex);
  return UNITY_END();
}
