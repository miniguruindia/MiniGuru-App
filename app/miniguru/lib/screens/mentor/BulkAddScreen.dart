import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../network/MiniguruApi.dart';
import '../../constants.dart';

class BulkAddScreen extends StatefulWidget {
  const BulkAddScreen({Key? key}) : super(key: key);
  @override
  State<BulkAddScreen> createState() => _BulkAddScreenState();
}

class _BulkAddScreenState extends State<BulkAddScreen> {
  final _ctrl = TextEditingController();
  late MiniguruApi _api;

  List<Map<String, String>> _parsed = [];
  List<dynamic> _results = [];
  bool _isParsed = false;
  bool _isLoading = false;
  bool _isDone = false;

  static const _headers = ['Child Name', 'Parent Name', 'Parent Phone', 'Grade'];

  @override
  void initState() {
    super.initState();
    _api = MiniguruApi();
  }

  void _parse() {
    final lines = _ctrl.text.trim().split('\n');
    final out = <Map<String, String>>[];
    for (final line in lines) {
      final s = line.trim();
      if (s.isEmpty) continue;
      final parts = s.contains('\t') ? s.split('\t') : s.split(',');
      out.add({
        'childName':   parts.length > 0 ? parts[0].trim() : '',
        'parentName':  parts.length > 1 ? parts[1].trim() : '',
        'parentPhone': parts.length > 2 ? parts[2].trim() : '',
        'grade':       parts.length > 3 ? parts[3].trim() : '',
      });
    }
    setState(() { _parsed = out; _isParsed = out.isNotEmpty; });
  }

  Future<void> _submit() async {
    setState(() => _isLoading = true);
    try {
      final results = await _api.bulkAddChildren(_parsed);
      setState(() { _results = results; _isDone = true; _isLoading = false; });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    }
  }

  void _copyResults() {
    final buf = StringBuffer('Child Name\tLogin Email\tPassword\tPIN\n');
    for (final r in _results) {
      buf.write('${r['childName']}\t${r['loginEmail']}\t${r['password']}\t${r['pin']}\n');
    }
    Clipboard.setData(ClipboardData(text: buf.toString()));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Credentials copied — paste into Excel to print')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundWhite,
      appBar: AppBar(
        backgroundColor: pastelBlueText,
        foregroundColor: Colors.white,
        title: Text('Bulk Add Students',
          style: GoogleFonts.nunito(fontWeight: FontWeight.w900, color: Colors.white)),
        elevation: 0,
      ),
      body: _isDone ? _buildResults() : _buildForm(),
    );
  }

  Widget _buildForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: pastelBlueText.withOpacity(0.08),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('How to paste:', style: GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 14)),
            const SizedBox(height: 6),
            Text('Open your Excel sheet → select rows → Copy → paste below.\nColumns: Child Name | Parent Name | Parent Phone | Grade',
              style: GoogleFonts.nunito(fontSize: 13, color: const Color(0xFF8888AA))),
            const SizedBox(height: 8),
            Text('Login ID will be: firstname+parentinitial.school.city@miniguru.in\nPassword: FirstName@${DateTime.now().year}',
              style: GoogleFonts.nunito(fontSize: 12, color: pastelBlueText, fontWeight: FontWeight.w700)),
          ]),
        ),
        const SizedBox(height: 16),
        Text('Paste student data here:', style: GoogleFonts.nunito(fontWeight: FontWeight.w900)),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: pastelBlueText.withOpacity(0.3)),
            borderRadius: BorderRadius.circular(10),
            color: Colors.white,
          ),
          child: TextField(
            controller: _ctrl,
            maxLines: 10,
            style: GoogleFonts.nunito(fontSize: 13),
            decoration: const InputDecoration(
              hintText: 'Riya Sharma\tSuresh Sharma\t9876543210\t6\nArjun Patel\tRamesh Patel\t9123456789\t7',
              border: InputBorder.none,
              contentPadding: EdgeInsets.all(12),
            ),
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _parse,
            style: ElevatedButton.styleFrom(
              backgroundColor: pastelBlueText,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: Text('Preview Students', style: GoogleFonts.nunito(fontWeight: FontWeight.w900, color: Colors.white)),
          ),
        ),
        if (_isParsed) ...[
          const SizedBox(height: 20),
          Text('${_parsed.length} students found — verify before adding:',
            style: GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 14)),
          const SizedBox(height: 10),
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: Colors.grey.shade200),
              borderRadius: BorderRadius.circular(10),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  headingRowColor: MaterialStateProperty.all(pastelBlueText.withOpacity(0.1)),
                  columns: _headers.map((h) => DataColumn(
                    label: Text(h, style: GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 12)),
                  )).toList(),
                  rows: _parsed.map((row) => DataRow(cells: [
                    DataCell(Text(row['childName'] ?? '', style: GoogleFonts.nunito(fontSize: 12))),
                    DataCell(Text(row['parentName'] ?? '', style: GoogleFonts.nunito(fontSize: 12))),
                    DataCell(Text(row['parentPhone'] ?? '', style: GoogleFonts.nunito(fontSize: 12))),
                    DataCell(Text(row['grade'] ?? '', style: GoogleFonts.nunito(fontSize: 12))),
                  ])).toList(),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: _isLoading
                ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : Text('Add All ${_parsed.length} Students', style: GoogleFonts.nunito(fontWeight: FontWeight.w900, color: Colors.white)),
            ),
          ),
        ],
      ]),
    );
  }

  Widget _buildResults() {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(12)),
          child: Row(children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 28),
            const SizedBox(width: 12),
            Expanded(child: Text('${_results.length} students added successfully!',
              style: GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 16, color: Colors.green.shade800))),
          ]),
        ),
        const SizedBox(height: 16),
        ElevatedButton.icon(
          onPressed: _copyResults,
          icon: const Icon(Icons.copy),
          label: Text('Copy credentials sheet (paste into Excel to print)',
            style: GoogleFonts.nunito(fontWeight: FontWeight.w900)),
          style: ElevatedButton.styleFrom(
            backgroundColor: pastelBlueText,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
        const SizedBox(height: 14),
        Expanded(
          child: ListView.builder(
            itemCount: _results.length,
            itemBuilder: (ctx, i) {
              final r = _results[i];
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(r['childName'] ?? '', style: GoogleFonts.nunito(fontWeight: FontWeight.w900, fontSize: 15)),
                    const SizedBox(height: 4),
                    Text('Login: ${r['loginEmail']}', style: GoogleFonts.nunito(fontSize: 13, color: pastelBlueText)),
                    Text('Password: ${r['password']}  |  PIN: ${r['pin']}',
                      style: GoogleFonts.nunito(fontSize: 13, color: const Color(0xFF8888AA))),
                  ]),
                ),
              );
            },
          ),
        ),
      ]),
    );
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }
}
