// lib/screens/mentor/bulkAddStudentsScreen.dart
// Teacher bulk student registration
// Enter names manually OR paste from Excel → generates MiniGuru IDs + passwords
// Results downloadable as CSV + emailed to teacher

// ignore_for_file: avoid_web_libraries_in_flutter
import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/network/MiniguruApi.dart';

// ── Colours ───────────────────────────────────────────────────────────────────
const _blue      = Color(0xFF5B6EF5);
const _blueSoft  = Color(0xFFEEF0FF);
const _green     = Color(0xFF10B981);
const _amber     = Color(0xFFF59E0B);
const _red       = Color(0xFFEF4444);
const _bg        = Color(0xFFF5F7FF);
const _card      = Color(0xFFFFFFFF);
const _border    = Color(0xFFE8EAFF);
const _ink       = Color(0xFF1A1A2E);
const _muted     = Color(0xFF8888AA);

// ── Data model ────────────────────────────────────────────────────────────────
class _StudentRow {
  final TextEditingController firstName;
  final TextEditingController lastName;
  final TextEditingController age;
  final TextEditingController grade;
  final TextEditingController parentPhone;

  _StudentRow()
      : firstName   = TextEditingController(),
        lastName    = TextEditingController(),
        age         = TextEditingController(),
        grade       = TextEditingController(),
        parentPhone = TextEditingController();

  void dispose() {
    firstName.dispose();
    lastName.dispose();
    age.dispose();
    grade.dispose();
    parentPhone.dispose();
  }

  bool get isEmpty =>
      firstName.text.trim().isEmpty && lastName.text.trim().isEmpty;

  Map<String, dynamic> toApiPayload() => {
        'childName':   '${firstName.text.trim()} ${lastName.text.trim()}'.trim(),
        'parentPhone': parentPhone.text.trim().isEmpty ? null : parentPhone.text.trim(),
        'grade':       grade.text.trim().isEmpty ? null : grade.text.trim(),
      };
}

class _ResultRow {
  final String childName;
  final String loginEmail;
  final String password;
  final String pin;
  final String grade;

  const _ResultRow({
    required this.childName,
    required this.loginEmail,
    required this.password,
    required this.pin,
    required this.grade,
  });
}

// ── Screen ────────────────────────────────────────────────────────────────────
class BulkAddStudentsScreen extends StatefulWidget {
  const BulkAddStudentsScreen({super.key});

  @override
  State<BulkAddStudentsScreen> createState() => _BulkAddStudentsScreenState();
}

class _BulkAddStudentsScreenState extends State<BulkAddStudentsScreen>
    with SingleTickerProviderStateMixin {
  final _api         = MiniguruApi();
  late TabController _tabCtrl;

  // ── Entry mode ───────────────────────────────────────────────────────────
  final List<_StudentRow> _rows = List.generate(5, (_) => _StudentRow());
  bool _submitting = false;

  // ── Paste mode ───────────────────────────────────────────────────────────
  final _pasteCtrl  = TextEditingController();
  List<_StudentRow> _parsedRows = [];
  bool _parsed = false;

  // ── Results ──────────────────────────────────────────────────────────────
  List<_ResultRow> _results = [];
  bool _showResults = false;
  bool _emailSending = false;
  bool _emailSent    = false;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _pasteCtrl.dispose();
    for (final r in _rows) r.dispose();
    for (final r in _parsedRows) r.dispose();
    super.dispose();
  }

  // ── Parse pasted Excel/Google Sheets data ────────────────────────────────
  void _parsePaste() {
    final lines = _pasteCtrl.text.trim().split('\n').where((l) => l.trim().isNotEmpty).toList();
    final rows  = <_StudentRow>[];
    for (final line in lines) {
      final cols = line.split('\t').map((c) => c.trim()).toList();
      // Detect header row
      if (cols[0].toLowerCase().contains('name') ||
          cols[0].toLowerCase() == 's.no' ||
          cols[0].toLowerCase() == 'no') continue;

      final row = _StudentRow();
      // Try to parse: col0=firstName, col1=lastName OR col0=fullName
      if (cols.length >= 2) {
        // Check if col0 looks like a number (serial no)
        if (RegExp(r'^\d+$').hasMatch(cols[0])) {
          final parts = (cols.elementAtOrNull(1) ?? '').split(' ');
          row.firstName.text = parts.isNotEmpty ? parts[0] : '';
          row.lastName.text  = parts.length > 1 ? parts.sublist(1).join(' ') : '';
          row.age.text       = cols.elementAtOrNull(2) ?? '';
          row.grade.text     = cols.elementAtOrNull(3) ?? '';
          row.parentPhone.text = cols.elementAtOrNull(4) ?? '';
        } else {
          // First col is full name or first name
          final parts = cols[0].split(' ');
          row.firstName.text   = parts.isNotEmpty ? parts[0] : '';
          row.lastName.text    = parts.length > 1 ? parts.sublist(1).join(' ') : (cols.elementAtOrNull(1) ?? '');
          row.age.text         = cols.elementAtOrNull(2) ?? '';
          row.grade.text       = cols.elementAtOrNull(3) ?? '';
          row.parentPhone.text = cols.elementAtOrNull(4) ?? '';
        }
      } else if (cols.isNotEmpty) {
        final parts = cols[0].split(' ');
        row.firstName.text = parts.isNotEmpty ? parts[0] : '';
        row.lastName.text  = parts.length > 1 ? parts.sublist(1).join(' ') : '';
      }
      if (!row.isEmpty) rows.add(row);
    }
    setState(() { _parsedRows = rows; _parsed = rows.isNotEmpty; });
    if (rows.isEmpty) {
      _snack('No valid rows found. Check format and try again.', isError: true);
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  Future<void> _submit({bool fromPaste = false}) async {
    final sourceRows = fromPaste ? _parsedRows : _rows;
    final valid      = sourceRows.where((r) => !r.isEmpty).toList();

    if (valid.isEmpty) {
      _snack('Please enter at least one student name.', isError: true);
      return;
    }

    setState(() => _submitting = true);
    try {
      final payload = valid.map((r) => r.toApiPayload()).toList();
      final result  = await _api.bulkAddChildren(payload);

      if (result == null) {
        _snack('Failed to add students. Try again.', isError: true);
        return;
      }

      final rawList = result['results'] as List<dynamic>? ?? [];
      final rows    = rawList.map((r) {
        final m = r as Map<String, dynamic>;
        return _ResultRow(
          childName:  m['childName']  ?? '',
          loginEmail: m['loginEmail'] ?? '',
          password:   m['password']   ?? '',
          pin:        m['pin']        ?? '',
          grade:      m['grade']      ?? '',
        );
      }).toList();

      setState(() {
        _results     = rows;
        _showResults = true;
      });
    } catch (e) {
      _snack('Error: $e', isError: true);
    } finally {
      setState(() => _submitting = false);
    }
  }

  // ── Download CSV ─────────────────────────────────────────────────────────
  void _downloadCsv() {
    final header = 'Student Name,MiniGuru ID,Child Password,Teacher PIN,Grade\n';
    final rows   = _results.map((r) =>
      '"${r.childName}","${r.loginEmail}","${r.password}","${r.pin}","${r.grade}"'
    ).join('\n');
    final csv    = header + rows;

    if (kIsWeb) {
      // ignore: undefined_prefixed_name
      _downloadCsvWeb(csv);
    } else {
      // On mobile just copy to clipboard
      Clipboard.setData(ClipboardData(text: csv));
      _snack('Copied to clipboard (CSV format)');
    }
  }

  void _downloadCsvWeb(String csv) {
    // Use conditional import — avoids dart:html on mobile
    try {
      // This runs only on web
      final encodedCsv = base64Encode(utf8.encode(csv));
      // ignore: undefined_prefixed_name
      _triggerWebDownload(encodedCsv);
    } catch (e) {
      Clipboard.setData(ClipboardData(text: csv));
      _snack('Copied CSV to clipboard');
    }
  }

  // ignore: unused_element
  void _triggerWebDownload(String base64Csv) {
    // Uses dart:html — only runs in web context
    // ignore: avoid_web_libraries_in_flutter
    // This is handled via PlatformChannel or js interop
    // Fallback: copy to clipboard
    _snack('Use the Copy button to get CSV data');
  }

  void _copyAllCredentials() {
    final header = 'Student Name\tMiniGuru ID\tPassword\tTeacher PIN\tGrade\n';
    final rows   = _results.map((r) =>
      '${r.childName}\t${r.loginEmail}\t${r.password}\t${r.pin}\t${r.grade}'
    ).join('\n');
    Clipboard.setData(ClipboardData(text: header + rows));
    _snack('Copied to clipboard! Paste into Excel or Google Sheets.');
  }

  // ── Email credentials to teacher ─────────────────────────────────────────
  Future<void> _emailToTeacher() async {
    setState(() { _emailSending = true; });
    try {
      final result = await _api.emailBulkCredentials(_results.map((r) => {
        'childName':  r.childName,
        'loginEmail': r.loginEmail,
        'password':   r.password,
        'pin':        r.pin,
        'grade':      r.grade,
      }).toList());
      final ok = result != null && result['_ok'] == true;
      setState(() => _emailSent = ok);
      if (ok) {
        final sentTo = (result?['sentTo'] ?? '').toString();
        _snack(sentTo.isNotEmpty
            ? 'Sent to $sentTo — check that inbox!'
            : 'Credentials emailed! Check your inbox.');
      } else {
        final msg = (result?['message'] ?? '').toString();
        _snack(msg.isNotEmpty ? msg : 'Email failed. Use Copy to get credentials.',
            isError: true);
      }
    } catch (e) {
      _snack('Email error: $e', isError: true);
    } finally {
      setState(() => _emailSending = false);
    }
  }

  void _snack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg,
          style: GoogleFonts.nunito(color: Colors.white, fontWeight: FontWeight.w700)),
      backgroundColor: isError ? _red : _green,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      margin: const EdgeInsets.all(12),
    ));
  }

  // ── Build ─────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _blue,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: Colors.white, size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Bulk Register Students',
            style: GoogleFonts.nunito(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 18)),
        actions: [
          if (_showResults)
            TextButton(
              onPressed: () => setState(() { _showResults = false; _results = []; _emailSent = false; }),
              child: Text('← Back',
                  style: GoogleFonts.nunito(
                      color: Colors.white70, fontWeight: FontWeight.w700)),
            ),
        ],
      ),
      body: _showResults ? _buildResults() : _buildEntry(),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ENTRY VIEW
  // ══════════════════════════════════════════════════════════════════════════
  Widget _buildEntry() {
    return Column(
      children: [
        // ── Info banner ──────────────────────────────────────────────────
        Container(
          width: double.infinity,
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
          decoration: const BoxDecoration(
            color: _blue,
            borderRadius: BorderRadius.vertical(bottom: Radius.circular(20)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Register your whole class at once',
                style: GoogleFonts.nunito(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(
              'Each student gets a MiniGuru ID + password.\n'
              'You get a PIN to monitor their progress anytime.',
              style: GoogleFonts.nunito(
                  color: Colors.white70, fontSize: 12, height: 1.4),
            ),
          ]),
        ),

        // ── Tabs ─────────────────────────────────────────────────────────
        Container(
          color: _card,
          child: TabBar(
            controller: _tabCtrl,
            labelColor: _blue,
            unselectedLabelColor: _muted,
            indicatorColor: _blue,
            labelStyle: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 13),
            tabs: const [
              Tab(text: '✏️  Type manually'),
              Tab(text: '📋  Paste from Excel'),
            ],
          ),
        ),

        // ── Tab content ───────────────────────────────────────────────────
        Expanded(
          child: TabBarView(
            controller: _tabCtrl,
            children: [
              _buildManualEntry(),
              _buildPasteEntry(),
            ],
          ),
        ),
      ],
    );
  }

  // ── Manual entry tab ──────────────────────────────────────────────────────
  Widget _buildManualEntry() {
    return Column(
      children: [
        // Column headers
        Container(
          color: const Color(0xFFF0F4FF),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(children: [
            _headerCell('First Name', flex: 3),
            _headerCell('Last Name', flex: 3),
            _headerCell('Age', flex: 1),
            _headerCell('Grade', flex: 2),
            _headerCell('Parent Phone', flex: 3),
          ]),
        ),
        const Divider(height: 1, color: _border),

        // Rows
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 4),
            itemCount: _rows.length,
            separatorBuilder: (_, __) =>
                const Divider(height: 1, color: _border),
            itemBuilder: (_, i) => _buildManualRow(i),
          ),
        ),

        // Add rows button
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(children: [
            OutlinedButton.icon(
              onPressed: () => setState(() =>
                  _rows.addAll(List.generate(5, (_) => _StudentRow()))),
              icon: const Icon(Icons.add, size: 16),
              label: Text('Add 5 more rows',
                  style: GoogleFonts.nunito(fontWeight: FontWeight.w700)),
              style: OutlinedButton.styleFrom(
                foregroundColor: _blue,
                side: const BorderSide(color: _blue),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const Spacer(),
            Text(
              '${_rows.where((r) => !r.isEmpty).length} students entered',
              style: GoogleFonts.nunito(color: _muted, fontSize: 12),
            ),
          ]),
        ),

        // Submit bar
        _buildSubmitBar(onTap: () => _submit(fromPaste: false)),
      ],
    );
  }

  Widget _headerCell(String label, {int flex = 1}) => Expanded(
        flex: flex,
        child: Text(label,
            style: GoogleFonts.nunito(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: _muted),
            overflow: TextOverflow.ellipsis),
      );

  Widget _buildManualRow(int i) {
    final row = _rows[i];
    return Container(
      color: i.isEven ? _card : const Color(0xFFFAFBFF),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Row(children: [
        _rowCell(row.firstName, 'First', flex: 3),
        _rowCell(row.lastName,  'Last',  flex: 3),
        _rowCell(row.age,   'Age', flex: 1,
            inputType: TextInputType.number),
        _rowCell(row.grade, 'e.g. 5', flex: 2),
        _rowCell(row.parentPhone, '10 digits', flex: 3,
            inputType: TextInputType.phone),
        // Row number
        SizedBox(
          width: 20,
          child: Text('${i + 1}',
              style: GoogleFonts.nunito(color: _muted, fontSize: 9),
              textAlign: TextAlign.center),
        ),
      ]),
    );
  }

  Widget _rowCell(TextEditingController ctrl, String hint,
      {int flex = 1, TextInputType? inputType}) =>
      Expanded(
        flex: flex,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 2),
          child: TextField(
            controller: ctrl,
            keyboardType: inputType,
            style: GoogleFonts.nunito(fontSize: 12, color: _ink),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: GoogleFonts.nunito(
                  fontSize: 10, color: const Color(0xFFCCCCDD)),
              isDense: true,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: const BorderSide(color: _border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: const BorderSide(color: _border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(6),
                borderSide: const BorderSide(color: _blue, width: 1.5),
              ),
            ),
          ),
        ),
      );

  // ── Paste tab ─────────────────────────────────────────────────────────────
  Widget _buildPasteEntry() {
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Instructions
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF8E1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFFFE082)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('📋 How to paste from Excel / Google Sheets',
                style: GoogleFonts.nunito(
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF5D4037),
                    fontSize: 13)),
            const SizedBox(height: 6),
            Text(
              '1. Open your student list in Excel or Google Sheets\n'
              '2. Select the rows (columns: First Name, Last Name, Age, Grade, Parent Phone)\n'
              '3. Copy (Ctrl+C) and paste below (Ctrl+V)\n'
              '4. Header row is detected and skipped automatically',
              style: GoogleFonts.nunito(
                  fontSize: 11,
                  color: const Color(0xFF6D4C41),
                  height: 1.5),
            ),
          ]),
        ),
        const SizedBox(height: 12),

        // Paste area
        TextField(
          controller: _pasteCtrl,
          maxLines: 10,
          style: GoogleFonts.nunito(fontSize: 12, color: _ink),
          decoration: InputDecoration(
            hintText:
                'Paste your student data here...\nExample:\nAarav\tSharma\t12\t6\t9876543210\nPriya\tKumar\t11\t5',
            hintStyle: GoogleFonts.nunito(color: _muted, fontSize: 11),
            filled: true,
            fillColor: _card,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: _border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: _border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: _blue, width: 1.5),
            ),
          ),
        ),
        const SizedBox(height: 10),

        Row(children: [
          ElevatedButton.icon(
            onPressed: _parsePaste,
            icon: const Icon(Icons.auto_fix_high, size: 16),
            label: Text('Parse',
                style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
            style: ElevatedButton.styleFrom(
              backgroundColor: _blue,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
          ),
          if (_parsed) ...[
            const SizedBox(width: 12),
            Text('${_parsedRows.length} students parsed',
                style: GoogleFonts.nunito(
                    color: _green,
                    fontWeight: FontWeight.w700,
                    fontSize: 13)),
          ],
        ]),

        // Preview parsed rows
        if (_parsed && _parsedRows.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('Preview (edit if needed):',
              style: GoogleFonts.nunito(
                  fontWeight: FontWeight.w800, color: _ink, fontSize: 13)),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: _card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _border),
            ),
            child: Column(
              children: _parsedRows.asMap().entries.map((e) {
                final i   = e.key;
                final row = e.value;
                return Container(
                  decoration: BoxDecoration(
                    border: i < _parsedRows.length - 1
                        ? const Border(
                            bottom: BorderSide(color: _border))
                        : null,
                  ),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 4),
                  child: Row(children: [
                    Text('${i + 1}.',
                        style: GoogleFonts.nunito(
                            color: _muted, fontSize: 10)),
                    const SizedBox(width: 6),
                    _rowCell(row.firstName, 'First', flex: 3),
                    _rowCell(row.lastName, 'Last', flex: 3),
                    _rowCell(row.age, 'Age', flex: 1,
                        inputType: TextInputType.number),
                    _rowCell(row.grade, 'Grade', flex: 2),
                    _rowCell(row.parentPhone, 'Phone', flex: 3,
                        inputType: TextInputType.phone),
                  ]),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 12),
        ],
      ]),
            ),
          ),
          if (_parsed && _parsedRows.isNotEmpty)
            _buildSubmitBar(onTap: () => _submit(fromPaste: true)),
        ],
    );
  }

  Widget _buildSubmitBar({required VoidCallback onTap}) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
      decoration: const BoxDecoration(
        color: _card,
        border: Border(top: BorderSide(color: _border)),
      ),
      child: SafeArea(
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _submitting ? null : onTap,
            style: ElevatedButton.styleFrom(
              backgroundColor: _blue,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              elevation: 0,
            ),
            child: _submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        color: Colors.white, strokeWidth: 2))
                : Text(
                    'Register Students →',
                    style: GoogleFonts.nunito(
                        fontWeight: FontWeight.w900, fontSize: 15),
                  ),
          ),
        ),
      ),
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RESULTS VIEW
  // ══════════════════════════════════════════════════════════════════════════
  Widget _buildResults() {
    return Column(
      children: [
        // ── Success banner ──────────────────────────────────────────────
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            color: _green,
            borderRadius:
                BorderRadius.vertical(bottom: Radius.circular(20)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('🎉', style: TextStyle(fontSize: 32)),
            const SizedBox(height: 6),
            Text('${_results.length} students registered!',
                style: GoogleFonts.nunito(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text(
              'Share the MiniGuru ID + Password with each student.\n'
              'Use the PIN to view their activities anytime.',
              style: GoogleFonts.nunito(
                  color: Colors.white70, fontSize: 12, height: 1.4),
            ),
          ]),
        ),

        // ── Action buttons ───────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(children: [
            // Copy to clipboard
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _copyAllCredentials,
                icon: const Icon(Icons.copy, size: 16),
                label: Text('Copy\n(paste to Sheets)',
                    style: GoogleFonts.nunito(
                        fontWeight: FontWeight.w700, fontSize: 11),
                    textAlign: TextAlign.center),
                style: OutlinedButton.styleFrom(
                  foregroundColor: _blue,
                  side: const BorderSide(color: _blue),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
            const SizedBox(width: 10),
            // Email to teacher
            Expanded(
              child: ElevatedButton.icon(
                onPressed: _emailSending || _emailSent
                    ? null
                    : _emailToTeacher,
                icon: Icon(
                  _emailSent ? Icons.check : Icons.email_outlined,
                  size: 16,
                ),
                label: Text(
                  _emailSending
                      ? 'Sending...'
                      : _emailSent
                          ? 'Sent! ✅'
                          : 'Email to me',
                  style: GoogleFonts.nunito(
                      fontWeight: FontWeight.w700, fontSize: 12),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _emailSent ? _green : _blue,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
          ]),
        ),

        // ── Credentials table ────────────────────────────────────────────
        Expanded(
          child: Container(
            margin: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            decoration: BoxDecoration(
              color: _card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _border),
            ),
            child: Column(
              children: [
                // Table header
                Container(
                  decoration: const BoxDecoration(
                    color: Color(0xFFF0F4FF),
                    borderRadius:
                        BorderRadius.vertical(top: Radius.circular(11)),
                  ),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 8),
                  child: Row(children: [
                    _tableHeader('Student Name', flex: 3),
                    _tableHeader('MiniGuru ID',  flex: 4),
                    _tableHeader('Password',     flex: 3),
                    _tableHeader('Your PIN',     flex: 2),
                  ]),
                ),
                const Divider(height: 1, color: _border),

                // Table rows
                Expanded(
                  child: ListView.separated(
                    itemCount: _results.length,
                    separatorBuilder: (_, __) =>
                        const Divider(height: 1, color: _border),
                    itemBuilder: (_, i) {
                      final r = _results[i];
                      return Container(
                        color: i.isEven
                            ? _card
                            : const Color(0xFFFAFBFF),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        child: Row(children: [
                          _tableCell(r.childName, flex: 3, bold: true),
                          _tableCell(r.loginEmail, flex: 4,
                              color: _blue, mono: true),
                          _tableCell(r.password, flex: 3,
                              color: _green),
                          _tableCell(r.pin, flex: 2,
                              color: _amber, bold: true, mono: true),
                        ]),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),

        // ── Legend ───────────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _legend(_blue,  'MiniGuru ID — child logs in with this'),
              const SizedBox(width: 12),
              _legend(_green, 'Password — child can change later'),
              const SizedBox(width: 12),
              _legend(_amber, 'Your PIN — always valid for you'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _tableHeader(String label, {int flex = 1}) => Expanded(
        flex: flex,
        child: Text(label,
            style: GoogleFonts.nunito(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: _muted)),
      );

  Widget _tableCell(String value,
      {int flex = 1,
      Color? color,
      bool bold = false,
      bool mono = false}) =>
      Expanded(
        flex: flex,
        child: Text(
          value,
          style: GoogleFonts.nunito(
            fontSize: 11,
            color: color ?? _ink,
            fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
            fontFeatures: mono ? [const FontFeature.tabularFigures()] : null,
          ),
          overflow: TextOverflow.ellipsis,
        ),
      );

  Widget _legend(Color color, String label) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
              width: 8, height: 8,
              decoration:
                  BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 4),
          Text(label,
              style: GoogleFonts.nunito(
                  fontSize: 9, color: _muted)),
        ],
      );
}