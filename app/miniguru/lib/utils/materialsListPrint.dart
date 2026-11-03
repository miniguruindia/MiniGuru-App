// Printable materials table for teachers (Nov 2026): small picture, name, Goins value, and a blank
// "Qty" column, so children can plan offline. Opens the print window (Save as PDF there).
// Compact layout (patch 63): two items side by side, so the full list needs about a third of the pages.
// A teacher can also print only "My Kit" (the items picked in the Shop), with the quantities filled in.
import 'package:miniguru/models/MaterialItem.dart';
import 'package:miniguru/repository/GoinsRepository.dart';
import 'package:miniguru/utils/printHelper_stub.dart'
    if (dart.library.html) 'package:miniguru/utils/printHelper_web.dart';

String _e(String s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

class _PrintRow {
  final String name;
  final String unit;
  final int goins;
  final String? imageUrl;
  final String? icon;
  final int? qty; // null = leave blank for writing by hand
  const _PrintRow(this.name, this.unit, this.goins, this.imageUrl, this.icon, this.qty);
}

String _cell(_PrintRow? r) {
  if (r == null) return '<td class="im"></td><td></td><td class="n"></td><td class="n"></td>';
  final img = (r.imageUrl ?? '').isNotEmpty
      ? '<img src="${_e(r.imageUrl!)}">'
      : '<span class="ic">${_e(r.icon ?? '')}</span>';
  final q = r.qty == null ? '' : '<b>${r.qty}</b>';
  return '<td class="im">$img</td><td>${_e(r.name)} <span class="u">per ${_e(r.unit)}</span></td>'
      '<td class="n"><b>${r.goins}</b></td><td class="n">$q</td>';
}

String _tableHtml(List<_PrintRow> list) {
  final b = StringBuffer();
  b.write('<table><colgroup>'
      '<col style="width:7%"><col style="width:30%"><col style="width:6.5%"><col style="width:6.5%">'
      '<col style="width:7%"><col style="width:30%"><col style="width:6.5%"><col style="width:6.5%"></colgroup>'
      '<tr><th class="im"></th><th>Material</th><th class="n">Goins</th><th class="n">Qty</th>'
      '<th class="im"></th><th>Material</th><th class="n">Goins</th><th class="n">Qty</th></tr>');
  for (var i = 0; i < list.length; i += 2) {
    b.write('<tr>${_cell(list[i])}${_cell(i + 1 < list.length ? list[i + 1] : null)}</tr>');
  }
  b.write('</table>');
  return b.toString();
}

String _page(String title, String sub, String body) {
  return '''<!doctype html><html><head><meta charset="utf-8"><title>MiniGuru $title</title>
<style>
@page{size:A4;margin:10mm}
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#1A1A2E;margin:0;font-size:10.5px}
.hd{border-bottom:3px solid #0A6CFF;padding-bottom:6px;margin-bottom:4px}
.logo{font-weight:900;font-size:20px;color:#0A6CFF;display:inline-block;margin-right:12px}.logo span{color:#FFC400}
.h1{font-weight:900;font-size:14px;display:inline-block}
.sub{color:#5F5F88;margin-top:2px;font-size:10px}
h2{font-size:12px;margin:10px 0 3px;color:#0A6CFF;page-break-after:avoid}
table{width:100%;border-collapse:collapse;table-layout:fixed}
tr{page-break-inside:avoid}
td,th{border:1px solid #889;padding:2px 4px;font-size:10.5px;text-align:left;height:27px;overflow:hidden}
th{background:#EAF3FF;height:18px;font-size:9.5px}
td:nth-child(5),th:nth-child(5){border-left:3px double #556}
.im{text-align:center;padding:1px}.im img{width:23px;height:23px;object-fit:cover;border-radius:3px;display:block;margin:0 auto}.ic{font-size:17px}
.n{text-align:center}
.u{color:#5F5F88;font-size:8.5px;white-space:nowrap}
.ft{margin-top:10px;font-size:9px;color:#5F5F88;border-top:1px solid #ccd;padding-top:3px}
</style></head><body>
<div class="hd"><span class="logo">Mini<span>Guru</span></span><span class="h1">$title</span>
<div class="sub">$sub</div></div>
$body
<div class="ft">miniguru.in · Goins values can change; check the app for today's value.</div>
</body></html>''';
}

String _today() {
  final d = DateTime.now();
  return '${d.day}/${d.month}/${d.year}';
}

String buildMaterialsListHtml(List<MaterialItem> items) {
  final groups = <String, List<MaterialItem>>{};
  for (final m in items.where((m) => m.isAvailable)) {
    groups.putIfAbsent(m.categoryName.isEmpty ? 'Other' : m.categoryName, () => []).add(m);
  }
  final keys = groups.keys.toList()..sort();
  final body = StringBuffer();
  for (final k in keys) {
    final list = groups[k]!..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    body.write('<h2>${_e(k)}</h2>');
    body.write(_tableHtml(list.map((m) => _PrintRow(m.name, m.unit, m.goinsPerUnit, m.imageUrl, m.icon, null)).toList()));
  }
  return _page('MATERIALS LIST',
      'Goins value of each material. Write how many you need in the Qty column. Printed ${_today()}.', body.toString());
}

/// Print only the items picked in the Shop's "My Kit", quantities filled in.
String buildKitListHtml(List<Map<String, dynamic>> kit) {
  final rows = kit.map((m) {
    final goins = ((m['goinsPrice'] ?? m['goinsPerUnit'] ?? 0) as num).toInt();
    final img = (m['imageUrl'] ?? '').toString();
    return _PrintRow(
      (m['name'] ?? '').toString(),
      (m['unit'] ?? 'piece').toString(),
      goins,
      img.isEmpty ? null : img,
      (m['icon'] ?? '').toString(),
      (m['qty'] as num?)?.toInt(),
    );
  }).toList()
    ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
  return _page('MY KIT',
      '${rows.length} items picked for the lab. Printed ${_today()}.', _tableHtml(rows));
}

/// Loads the full list and opens the print window. Returns false when printing is not available here.
Future<bool> printMaterialsList() async {
  final items = await GoinsRepository().getMaterials();
  return printHtmlDocument(buildMaterialsListHtml(items));
}

/// Opens the print window for the picked kit only.
Future<bool> printKitList(List<Map<String, dynamic>> kit) async {
  return printHtmlDocument(buildKitListHtml(kit));
}
