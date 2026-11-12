// MiniGuru Text (Nov 2026). Works exactly like Flutter's Text, but if the app is in Hindi it shows the Hindi for that
// English text (see utils/i18n.dart and the hi_strings files). Words with no Hindi entry, and words that carry a changing
// part (a name, a number), stay as they are. Files use it with:
//   import 'package:flutter/material.dart' hide Text;
//   import 'package:miniguru/widgets/mgText.dart';
import 'package:flutter/material.dart' as m;
import 'package:miniguru/utils/i18n.dart';

class Text extends m.StatelessWidget {
  final String data;
  final m.TextStyle? style;
  final dynamic strutStyle; // StrutStyle?
  final m.TextAlign? textAlign;
  final dynamic textDirection; // TextDirection?
  final dynamic locale; // Locale?
  final bool? softWrap;
  final m.TextOverflow? overflow;
  final dynamic textScaler; // TextScaler?
  final int? maxLines;
  final String? semanticsLabel;
  final dynamic textWidthBasis; // TextWidthBasis?
  final dynamic textHeightBehavior; // TextHeightBehavior?
  final dynamic selectionColor; // Color?

  const Text(
    this.data, {
    super.key,
    this.style,
    this.strutStyle,
    this.textAlign,
    this.textDirection,
    this.locale,
    this.softWrap,
    this.overflow,
    this.textScaler,
    this.maxLines,
    this.semanticsLabel,
    this.textWidthBasis,
    this.textHeightBehavior,
    this.selectionColor,
  });

  @override
  m.Widget build(m.BuildContext context) {
    return m.ValueListenableBuilder<String>(
      valueListenable: I18n.lang,
      builder: (c, _, __) => m.Text(
        I18n.t(data),
        style: style,
        strutStyle: strutStyle,
        textAlign: textAlign,
        textDirection: textDirection,
        locale: locale,
        softWrap: softWrap,
        overflow: overflow,
        textScaler: textScaler,
        maxLines: maxLines,
        semanticsLabel: semanticsLabel,
        textWidthBasis: textWidthBasis,
        textHeightBehavior: textHeightBehavior,
        selectionColor: selectionColor,
      ),
    );
  }
}
