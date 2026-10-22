// lib/widgets/mgIcons.dart
//
// Google-colour palette + colourful icon helpers used for the "colourful
// children's app" look (Oct 2026). Plain Material icons only (no emoji fonts,
// no images, no animation) so nothing here can slow the app down.

import 'package:flutter/material.dart';

class GColors {
  GColors._();

  // Google blue / green / yellow / red.
  static const blue = Color(0xFF0A6CFF);
  static const green = Color(0xFF12B24A);
  static const yellow = Color(0xFFFFB800); // readable on white
  static const red = Color(0xFFFF3B30);

  // Soft tints for box backgrounds.
  static const blueLight = Color(0xFFCFE3FF);
  static const greenLight = Color(0xFFC8F2D4);
  static const yellowLight = Color(0xFFFFEFA8);
  static const redLight = Color(0xFFFFD3CF);

  // Dark shades for text that sits on the tints.
  static const blueDark = Color(0xFF0A4FD6);
  static const greenDark = Color(0xFF0A7A32);
  static const yellowDark = Color(0xFF8F5A00);
  static const redDark = Color(0xFFA3150C);

  // Extra bright colours (Oct 2026) so the app feels playful to boys and girls
  // aged 8 to 14: purple, pink, orange and teal.
  static const orange = Color(0xFFFF8A00);
  static const purple = Color(0xFF8A3FFC);
  static const pink = Color(0xFFFF3D8B);
  static const teal = Color(0xFF00B8A9);
  static const orangeLight = Color(0xFFFFE0B8);
  static const purpleLight = Color(0xFFE6D4FF);
  static const pinkLight = Color(0xFFFFD0E4);
  static const tealLight = Color(0xFFBFF3EE);
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
    // Selected: solid bright pill with a white icon and a soft glow.
    // Not selected: the icon in its own colour on a light tint of that colour.
    return Container(
      width: 48,
      height: 30,
      decoration: BoxDecoration(
        color: selected ? color : color.withOpacity(0.16),
        borderRadius: BorderRadius.circular(16),
        boxShadow: selected
            ? [BoxShadow(color: color.withOpacity(0.45), blurRadius: 8, offset: const Offset(0, 2))]
            : null,
      ),
      alignment: Alignment.center,
      child: Icon(icon, size: 22, color: selected ? Colors.white : color),
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
      decoration: BoxDecoration(color: color.withOpacity(0.24), shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Icon(icon, size: size * 0.52, color: color),
    );
  }
}

/// Colour for the little icon inside login / register form fields.
Color mgFieldIconColor(IconData icon) {
  if (icon == Icons.email_outlined) return GColors.red;
  if (icon == Icons.lock_outline || icon == Icons.phone_outlined) return GColors.green;
  if (icon == Icons.cake_outlined || icon == Icons.badge_outlined) return GColors.yellowDark;
  if (icon == Icons.location_city_outlined || icon == Icons.map_outlined) return GColors.red;
  if (icon == Icons.supervisor_account_outlined || icon == Icons.business_outlined) return GColors.green;
  return GColors.blue;
}
