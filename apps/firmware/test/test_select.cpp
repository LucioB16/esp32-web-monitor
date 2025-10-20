#include <Arduino.h>
#include <CssSelectMini.h>
#include <unity.h>

void test_select_by_id() {
  const String html =
      "<div><span id=\"Price\">$ 9.99</span><span class=\"status\">ok</span></div>";
  CssSelectMini css;
  String text;
  TEST_ASSERT_TRUE(css.selectInnerText(html, "#price", text));
  TEST_ASSERT_EQUAL_STRING("$ 9.99", text.c_str());
}

void test_select_by_class_case_insensitive() {
  const String html =
      "<div><p class=\"Value Highlight\">Oferta</p><p class=\"value\">Final</p></div>";
  CssSelectMini css;
  String text;
  TEST_ASSERT_TRUE(css.selectInnerText(html, "p.value", text));
  TEST_ASSERT_EQUAL_STRING("Oferta", text.c_str());
}

void test_select_nth_of_type() {
  const String html =
      "<ul><li>Uno</li><li class=\"target\">Dos</li><li>Tres</li></ul>";
  CssSelectMini css;
  String text;
  TEST_ASSERT_TRUE(css.selectInnerText(html, "li:nth-of-type(2)", text));
  TEST_ASSERT_EQUAL_STRING("Dos", text.c_str());
}

void test_select_missing_returns_false() {
  const String html = "<div><span class=\"item\">dato</span></div>";
  CssSelectMini css;
  String text;
  TEST_ASSERT_FALSE(css.selectInnerText(html, "span.otra", text));
}

int main(int, char **) {
  UNITY_BEGIN();
  RUN_TEST(test_select_by_id);
  RUN_TEST(test_select_by_class_case_insensitive);
  RUN_TEST(test_select_nth_of_type);
  RUN_TEST(test_select_missing_returns_false);
  return UNITY_END();
}
