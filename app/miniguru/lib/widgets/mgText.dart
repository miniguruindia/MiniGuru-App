// MiniGuru Text (Nov 2026). Works exactly like Flutter's Text, kept so existing screens need no edits. Files use it with:
//   import 'package:flutter/material.dart' hide Text;
//   import 'package:miniguru/widgets/mgText.dart';
import 'package:flutter/material.dart' as m;

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
    return m.Text(
      data,
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
    );
  }
}
