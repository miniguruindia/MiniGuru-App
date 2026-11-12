// English | हिन्दी switch (Nov 2026), with a note that the Hindi is machine-translated and a way to suggest better words.
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:miniguru/utils/i18n.dart';

class LanguageToggle extends StatelessWidget {
  final String screen; // which screen it is on, sent along with a suggestion
  const LanguageToggle({super.key, this.screen = 'login'});

  Widget _chip(String label, String code, String current) {
    final sel = current == code;
    return ChoiceChip(
      label: Text(label, style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w700)),
      selected: sel,
      onSelected: (_) => I18n.setLang(code),
      visualDensity: VisualDensity.compact,
    );
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<String>(
      valueListenable: I18n.lang,
      builder: (ctx, lang, _) => Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Row(mainAxisSize: MainAxisSize.min, children: [
          _chip('English', 'en', lang),
          const SizedBox(width: 8),
          _chip('हिन्दी', 'hi', lang),
        ]),
        if (lang == 'hi')
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Wrap(alignment: WrapAlignment.end, crossAxisAlignment: WrapCrossAlignment.center, children: [
              Text(tr('This Hindi is machine-translated and may have mistakes.'),
                  textAlign: TextAlign.right,
                  style: GoogleFonts.poppins(fontSize: 11, color: Colors.grey[700])),
              TextButton(
                onPressed: () => showHindiSuggestDialog(context, screen),
                style: TextButton.styleFrom(visualDensity: VisualDensity.compact, padding: const EdgeInsets.symmetric(horizontal: 6)),
                child: Text(tr('Suggest a better word'),
                    style: GoogleFonts.poppins(fontSize: 12, fontWeight: FontWeight.w700)),
              ),
            ]),
          ),
      ]),
    );
  }
}

Future<void> showHindiSuggestDialog(BuildContext context, String screen) {
  final searchCtrl = TextEditingController();
  final fixCtrl = TextEditingController();
  String? chosenKey;
  String? error;
  bool sending = false;
  return showDialog(
    context: context,
    builder: (dialogContext) => StatefulBuilder(builder: (ctx, setSt) {
      final matches = chosenKey == null ? I18n.search(searchCtrl.text) : <MapEntry<String, String>>[];
      return AlertDialog(
        title: Text(tr('Suggest a better Hindi word'), style: GoogleFonts.poppins(fontWeight: FontWeight.w700, fontSize: 18)),
        content: SizedBox(
          width: 360,
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (chosenKey == null) ...[
                TextField(
                  controller: searchCtrl,
                  onChanged: (_) => setSt(() {}),
                  decoration: InputDecoration(hintText: tr('Type part of the word you want to fix'), isDense: true),
                ),
                const SizedBox(height: 8),
                if (searchCtrl.text.trim().length >= 2 && matches.isEmpty)
                  Text(tr('No match found'), style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[700])),
                for (final m in matches)
                  ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(m.value.isEmpty ? m.key : m.value, style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600)),
                    subtitle: Text(m.key, style: GoogleFonts.poppins(fontSize: 11)),
                    onTap: () => setSt(() { chosenKey = m.key; fixCtrl.text = m.value; error = null; }),
                  ),
              ] else ...[
                Text(chosenKey!, style: GoogleFonts.poppins(fontSize: 12, color: Colors.grey[700])),
                const SizedBox(height: 4),
                Text('${tr('Currently:')} ${I18n.hindiFor(chosenKey!) ?? ''}', style: GoogleFonts.poppins(fontSize: 13)),
                const SizedBox(height: 10),
                TextField(
                  controller: fixCtrl,
                  maxLength: 200,
                  decoration: InputDecoration(labelText: tr('Correct Hindi'), errorText: error),
                ),
                Text(tr('Please do not write phone numbers, emails or addresses.'),
                    style: GoogleFonts.poppins(fontSize: 11, color: Colors.grey[600])),
              ],
            ]),
          ),
        ),
        actions: [
          TextButton(onPressed: sending ? null : () => Navigator.of(dialogContext).pop(), child: Text(tr('Close'))),
          if (chosenKey != null)
            ElevatedButton(
              onPressed: sending
                  ? null
                  : () async {
                      final text = fixCtrl.text.trim();
                      if (text.isEmpty) return;
                      setSt(() { sending = true; error = null; });
                      final err = await I18n.suggest(chosenKey!, text, screen);
                      if (!dialogContext.mounted) return;
                      if (err == null) {
                        Navigator.of(dialogContext).pop();
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr('Thank you! Our team will check it.'))));
                      } else {
                        setSt(() { sending = false; error = err; });
                      }
                    },
              child: Text(tr('Send')),
            ),
        ],
      );
    }),
  );
}
