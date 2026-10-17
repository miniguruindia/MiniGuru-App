// lib/widgets/mgIcons.dart
//
// Google-colour palette + colourful icon helpers used for the "colourful
// children's app" look (Oct 2026). Plain Material icons only (no emoji fonts,
// no images, no animation) so nothing here can slow the app down.

import 'package:flutter/material.dart';

class GColors {
  GColors._();

  // Google blue / green / yellow / red.
  static const blue = Color(0xFF4285F4);
  static const green = Color(0xFF34A853);
  static const yellow = Color(0xFFF9AB00); // readable on white
  static const red = Color(0xFFEA4335);

  // Soft tints for box backgrounds.
  static const blueLight = Color(0xFFE8F0FE);
  static const greenLight = Color(0xFFE6F4EA);
  static const yellowLight = Color(0xFFFEF7E0);
  static const redLight = Color(0xFFFCE8E6);

  // Dark shades for text that sits on the tints.
  static const blueDark = Color(0xFF1A5BC4);
  static const greenDark = Color(0xFF1E7E34);
  static const yellowDark = Color(0xFFB06F00);
  static const redDark = Color(0xFFB3261E);
}

/// Colourful icon for the bottom bar (phone) and the left strip (laptop).
/// Selected = filled icon on a soft tinted pill; unselected = same colour,
/// slightly softer, so the bar stays colourful at all times.
class NavIcon extends StatelessWidget {
  final IconData icon;
  final Color color;
  final bool selected;
  const NavIcon({
    super.key,
    required this.icon,
    required this.color,
    this.selected = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 42,
      height: 26,
      decoration: BoxDecoration(
        color: selected ? color.withOpacity(0.16) : Colors.transparent,
        borderRadius: BorderRadius.circular(13),
      ),
      alignment: Alignment.center,
      child: Icon(icon, size: 22, color: selected ? color : color.withOpacity(0.72)),
    );
  }
}

/// Round coloured badge with an icon in it (used for notification rows etc.).
class IconBadge extends StatelessWidget {
  final IconData icon;
  final Color color;
  final double size;
  const IconBadge({super.key, required this.icon, required this.color, this.size = 42});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color.withOpacity(0.15), shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Icon(icon, size: size * 0.52, color: color),
    );
  }
}
