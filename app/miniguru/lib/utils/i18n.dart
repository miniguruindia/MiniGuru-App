// tr('English text') is kept as a plain pass-through: it returns the same English text.
// For words with a changing part use tr('Sent to {mail}', {'mail': x}).
String tr(String en, [Map<String, String>? args]) {
  var out = en;
  if (args != null) args.forEach((k, v) => out = out.replaceAll('{$k}', v));
  return out;
}
