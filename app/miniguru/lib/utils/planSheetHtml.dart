// Builds the printable A4 "Project Planning Sheet" (Nov 2026). Empty parts stay blank
// so a child can write by hand. When the project is published, a box with the
// thumbnail, publish date/time, Goins and YouTube views is added.
const _mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

String _esc(String? s) => (s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

String _day(DateTime? d) => d == null ? '' : '${d.day} ${_mon[d.month - 1]} ${d.year}';

String _dayTime(DateTime? d) {
  if (d == null) return '';
  final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
  return '${_day(d)}, $h:${d.minute.toString().padLeft(2, '0')} ${d.hour < 12 ? 'am' : 'pm'}';
}

class PlanSheetData {
  final String? planId;
  final DateTime? planCreatedAt;
  final String maker;
  final String school;
  final String title;
  final String description;
  final String category;
  final DateTime? startDate;
  final DateTime? endDate;
  final List<MapEntry<String, int>> materials;
  final String? sketchB64; // PNG/JPEG base64
  final bool published;
  final String? thumbnail;
  final DateTime? publishedAt;
  final int? goins;
  final int? views;
  final String? videoCode;
  PlanSheetData({
    this.planId, this.planCreatedAt, this.maker = '', this.school = '', this.title = '',
    this.description = '', this.category = '', this.startDate, this.endDate,
    this.materials = const [], this.sketchB64, this.published = false, this.thumbnail,
    this.publishedAt, this.goins, this.views, this.videoCode,
  });

  factory PlanSheetData.fromServer(Map<String, dynamic> j) {
    DateTime? dt(dynamic v) => v == null ? null : DateTime.tryParse(v.toString())?.toLocal();
    return PlanSheetData(
      planId: j['planId']?.toString(),
      planCreatedAt: dt(j['planCreatedAt']),
      maker: j['maker']?.toString() ?? '',
      school: j['school']?.toString() ?? '',
      title: j['title']?.toString() ?? '',
      description: j['description']?.toString() ?? '',
      category: j['category']?.toString() ?? '',
      startDate: dt(j['startDate']),
      endDate: dt(j['endDate']),
      materials: [
        for (final m in (j['materials'] as List? ?? []))
          MapEntry(m['name']?.toString() ?? '', (m['quantity'] as num?)?.toInt() ?? 0)
      ],
      sketchB64: j['sketch']?.toString(),
      published: j['published'] == true,
      thumbnail: j['thumbnail']?.toString(),
      publishedAt: dt(j['publishedAt']),
      goins: (j['goins'] as num?)?.toInt(),
      views: (j['views'] as num?)?.toInt(),
      videoCode: j['videoCode']?.toString(),
    );
  }
}

String buildPlanSheetHtml(PlanSheetData d) {
  final blankRows = (d.materials.length >= 8) ? 2 : 8 - d.materials.length;
  final rows = StringBuffer();
  for (final m in d.materials) {
    rows.write('<tr><td>${_esc(m.key)}</td><td class="q">${m.value}</td></tr>');
  }
  for (var i = 0; i < blankRows; i++) {
    rows.write('<tr><td>&nbsp;</td><td></td></tr>');
  }
  final sketch = (d.sketchB64 != null && d.sketchB64!.isNotEmpty)
      ? '<img class="skimg" src="data:image/png;base64,${d.sketchB64}">'
      : '';
  final pub = d.published
      ? '''<div class="pub"><div class="pt">🎉 PUBLISHED</div><div class="pr">
${(d.thumbnail ?? '').isNotEmpty ? '<img class="th" src="${_esc(d.thumbnail)}">' : '<div class="th"></div>'}
<div><b>${_esc(d.title)}</b>
<div class="mut">${d.publishedAt != null ? 'Published ${_dayTime(d.publishedAt)}' : 'Published'}${(d.videoCode ?? '').isNotEmpty ? ' &middot; Video ID ${_esc(d.videoCode)}' : ''}</div>
<div class="st">${d.goins != null ? '<span>🪙 ${d.goins} Goins earned</span>' : ''}${d.views != null ? '<span>▶ ${d.views} views on YouTube</span>' : ''}</div>
</div></div></div>'''
      : '';
  final now = DateTime.now();
  return '''<!doctype html><html><head><meta charset="utf-8"><title>${_esc(d.planId ?? 'Planning sheet')}</title>
<style>
@page{size:A4;margin:12mm}
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#1A1A2E;margin:0;font-size:12px}
.hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0A6CFF;padding-bottom:8px}
.logo{font-weight:900;font-size:22px;color:#0A6CFF}.logo span{color:#FFC400}
.h1{font-weight:900;font-size:16px;margin-top:2px}
.idb{text-align:right}.idb b{font-size:19px;color:#0A6CFF}.idb small{display:block;color:#5F5F88;margin-top:2px}
.lbl{font-size:10px;font-weight:700;color:#5F5F88;text-transform:uppercase;letter-spacing:.6px;margin-top:10px}
.val{border-bottom:1px solid #889;min-height:22px;padding:3px 0;font-size:13px}
.box{border:1.5px solid #889;border-radius:6px;min-height:80px;padding:6px;white-space:pre-wrap;font-size:12.5px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.sk{border:1.5px dashed #889;border-radius:6px;min-height:150px;display:flex;align-items:center;justify-content:center}
.skimg{max-width:100%;max-height:260px}
table{width:100%;border-collapse:collapse;margin-top:3px}td,th{border:1px solid #889;padding:4px 6px;height:22px;font-size:12px;text-align:left}th{background:#EAF3FF}.q{width:60px;text-align:center}
.lines{height:110px;background:repeating-linear-gradient(transparent 0 21px,#99a 21px 22px)}
.pub{margin-top:14px;border:2px solid #0A6CFF;border-radius:10px;padding:10px;background:#F4F8FF;page-break-inside:avoid}
.pt{font-weight:900;margin-bottom:6px}.pr{display:flex;gap:12px;align-items:center}
.th{width:150px;height:84px;object-fit:cover;border-radius:6px;background:#dde}
.mut{color:#5F5F88;margin-top:2px}.st span{display:inline-block;background:#fff;border:1px solid #bcd;border-radius:10px;padding:2px 8px;font-weight:700;margin:5px 6px 0 0}
.ft{margin-top:14px;border-top:1px solid #ccd;padding-top:4px;font-size:9.5px;color:#5F5F88;display:flex;justify-content:space-between}
</style></head><body>
<div class="hd"><div><div class="logo">Mini<span>Guru</span></div><div class="h1">PROJECT PLANNING SHEET</div></div>
<div class="idb"><b>${_esc(d.planId ?? '')}</b><small>${d.planCreatedAt != null ? 'Planned on ${_dayTime(d.planCreatedAt)}' : ''}</small></div></div>
<div class="two"><div><div class="lbl">Maker</div><div class="val">${_esc(d.maker)}</div></div><div><div class="lbl">School</div><div class="val">${_esc(d.school)}</div></div></div>
<div class="lbl">Project title</div><div class="val">${_esc(d.title)}</div>
<div class="two"><div><div class="lbl">Category</div><div class="val">${_esc(d.category)}</div></div>
<div><div class="lbl">Start &ndash; finish</div><div class="val">${d.startDate != null || d.endDate != null ? '${_day(d.startDate)} &ndash; ${_day(d.endDate)}' : ''}</div></div></div>
<div class="lbl">What I will build and why</div><div class="box">${_esc(d.description)}</div>
<div class="lbl">My sketch</div><div class="sk">$sketch</div>
<div class="lbl">Materials I need</div>
<table><tr><th>Material</th><th class="q">Qty</th></tr>$rows</table>
<div class="lbl">Steps / notes (write by hand)</div><div class="lines"></div>
$pub
<div class="ft"><span>miniguru.in</span><span>Printed ${_day(now)}${d.published ? ' &middot; numbers as on this date' : ''}</span></div>
</body></html>''';
}
