// Printable materials table for teachers (Nov 2026): small picture, name, Goins value, and a blank
// "How many" column, so children can plan offline. Opens the print window (Save as PDF there).
import 'package:miniguru/models/MaterialItem.dart';
import 'package:miniguru/repository/GoinsRepository.dart';
import 'package:miniguru/utils/printHelper_stub.dart'
    if (dart.library.html) 'package:miniguru/utils/printHelper_web.dart';

String _e(String s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

String buildMaterialsListHtml(List<MaterialItem> items) {
  final groups = <String, List<MaterialItem>>{};
  for (final m in items.where((m) => m.isAvailable)) {
    groups.putIfAbsent(m.categoryName.isEmpty ? 'Other' : m.categoryName, () => []).add(m);
  }
  final keys = groups.keys.toList()..sort();
  final body = StringBuffer();
  for (final k in keys) {
    final list = groups[k]!..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    body.write('<h2>${_e(k)}</h2><table><tr><th class="im"></th><th>Material</th><th class="n">Goins</th><th class="n">How many?</th></tr>');
    for (final m in list) {
      final img = (m.imageUrl ?? '').isNotEmpty
          ? '<img src="${_e(m.imageUrl!)}">'
          : '<span class="ic">${_e(m.icon ?? '')}</span>';
      body.write('<tr><td class="im">$img</td><td>${_e(m.name)}<div class="u">per ${_e(m.unit)}</div></td>'
          '<td class="n"><b>${m.goinsPerUnit}</b></td><td class="n"></td></tr>');
    }
    body.write('</table>');
  }
  final d = DateTime.now();
  return '''<!doctype html><html><head><meta charset="utf-8"><title>MiniGuru materials list</title>
<style>
@page{size:A4;margin:12mm}
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#1A1A2E;margin:0;font-size:12px}
.hd{border-bottom:3px solid #0A6CFF;padding-bottom:8px;margin-bottom:6px}
.logo{font-weight:900;font-size:22px;color:#0A6CFF}.logo span{color:#FFC400}
.h1{font-weight:900;font-size:16px}
.sub{color:#5F5F88;margin-top:2px}
h2{font-size:14px;margin:14px 0 4px;color:#0A6CFF;page-break-after:avoid}
table{width:100%;border-collapse:collapse}
tr{page-break-inside:avoid}
td,th{border:1px solid #889;padding:3px 6px;font-size:12px;text-align:left;height:34px}
th{background:#EAF3FF;height:22px}
.im{width:46px;text-align:center;padding:2px}.im img{width:36px;height:36px;object-fit:cover;border-radius:4px}.ic{font-size:22px}
.n{width:80px;text-align:center}
.u{color:#5F5F88;font-size:10px}
.ft{margin-top:14px;font-size:9.5px;color:#5F5F88;border-top:1px solid #ccd;padding-top:4px}
</style></head><body>
<div class="hd"><div class="logo">Mini<span>Guru</span></div><div class="h1">MATERIALS LIST</div>
<div class="sub">Goins value of each material. Write how many you need in the last column. Printed ${d.day}/${d.month}/${d.year}.</div></div>
$body
<div class="ft">miniguru.in · Goins values can change; check the app for today's value.</div>
</body></html>''';
}

/// Loads the list and opens the print window. Returns false when printing is not available here.
Future<bool> printMaterialsList() async {
  final items = await GoinsRepository().getMaterials();
  return printHtmlDocument(buildMaterialsListHtml(items));
}
