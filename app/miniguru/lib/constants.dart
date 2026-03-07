// lib/constants.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  LEGACY COLORS — kept exactly so existing screens don't break
// ─────────────────────────────────────────────────────────────────────────────

const backgroundWhite   = Color(0xFFFAFAFA);
const pastelBlue        = Color(0xFFCBE2FF);
const pastelRed         = Color(0xFFFFE9EE);
const pastelYellow      = Color(0xFFFDE0C0);
const pastelGreen       = Color(0xFFA6F5A6);
const buttonBlack       = Color(0xFF121212);
const pastelBlueText    = Color(0xFF80B8FF);
const pastelYellowText  = Color(0xFFFAB367);
const pastelRedText     = Color(0xFFFF9BB5);
const pastelGreenText   = Color(0xFF5AEC5A);

// ─────────────────────────────────────────────────────────────────────────────
//  LEGACY TEXT STYLES — kept exactly, now use Nunito instead of Poppins
// ─────────────────────────────────────────────────────────────────────────────

TextStyle headingTextStyle = GoogleFonts.nunito(fontWeight: FontWeight.w900, 
  color: MGColors.textPrimary,
  fontSize: 20.0,
);

TextStyle buttonTextStyle = GoogleFonts.nunito(
  color: Colors.white,
  fontSize: 16.0,
  fontWeight: FontWeight.w700,
);

TextStyle bodyTextStyle = GoogleFonts.nunito(
  color: MGColors.textBody,
  fontSize: 15.0,
  fontWeight: FontWeight.w500,
);

// ─────────────────────────────────────────────────────────────────────────────
//  MG DESIGN SYSTEM — Light Pastel · Fredoka One + Nunito
// ─────────────────────────────────────────────────────────────────────────────

class MGColors {
  MGColors._();

  // ── Backgrounds
  static const bg         = Color(0xFFF5F7FF);   // soft lavender-white
  static const bgCard     = Color(0xFFFFFFFF);   // pure white cards
  static const bgCardAlt  = Color(0xFFF0F4FF);   // slightly tinted surface

  // ── Brand
  static const primary      = Color(0xFF5B6EF5);   // indigo-blue (kids, trustworthy)
  static const primaryLight = Color(0xFFDDE1FF);   // tinted primary bg
  static const primaryDark  = Color(0xFF3A4DD4);

  // ── Goins — golden economy
  static const goins      = Color(0xFFE8A000);   // warm amber gold (readable on white)
  static const goinsLight = Color(0xFFFFF3CC);   // pale gold bg
  static const goinsGlow  = Color(0x33E8A000);

  // ── Accents
  static const coral      = Color(0xFFFF5C5C);   // energy / alerts / checkout
  static const coralLight = Color(0xFFFFECEC);
  static const mint       = Color(0xFF00B894);   // success / approved
  static const mintLight  = Color(0xFFD4F5EE);
  static const sky        = Color(0xFF0984E3);   // info / videos
  static const skyLight   = Color(0xFFD6EEFF);

  // ── Pastel category palette
  static const List<Color> categoryPalette = [
    Color(0xFF5B6EF5),   // indigo
    Color(0xFFFF5C5C),   // coral
    Color(0xFF00B894),   // mint
    Color(0xFFE8A000),   // gold
    Color(0xFF0984E3),   // sky
    Color(0xFFFF9F43),   // orange
    Color(0xFFEE5A24),   // deep orange
  ];

  static const List<Color> categoryPaletteLight = [
    Color(0xFFDDE1FF),
    Color(0xFFFFECEC),
    Color(0xFFD4F5EE),
    Color(0xFFFFF3CC),
    Color(0xFFD6EEFF),
    Color(0xFFFFEDD5),
    Color(0xFFFFE0D4),
  ];

  // ── Text
  static const textPrimary   = Color(0xFF1A1A2E);   // near-black with blue tint
  static const textBody      = Color(0xFF3D3D5C);   // readable body
  static const textSecondary = Color(0xFF6B6B8A);   // muted labels
  static const textMuted     = Color(0xFFAAAAAC);   // placeholders

  // ── Borders & dividers
  static const border      = Color(0xFFE8EAFF);
  static const borderMid   = Color(0xFFD0D4F0);
  static const divider     = Color(0xFFF0F2FF);
}

// ─────────────────────────────────────────────────────────────────────────────

class MGRadius {
  MGRadius._();
  static const xs   = 6.0;
  static const sm   = 10.0;
  static const md   = 14.0;
  static const lg   = 18.0;
  static const xl   = 24.0;
  static const pill = 100.0;
}

class MGSpacing {
  MGSpacing._();
  static const xs  = 4.0;
  static const sm  = 8.0;
  static const md  = 16.0;
  static const lg  = 24.0;
  static const xl  = 32.0;
  static const xxl = 48.0;
}

class MGShadow {
  MGShadow._();

  static List<BoxShadow> card = [
    BoxShadow(
      color: const Color(0xFF5B6EF5).withOpacity(0.08),
      blurRadius: 16,
      offset: const Offset(0, 4),
    ),
    BoxShadow(
      color: Colors.black.withOpacity(0.04),
      blurRadius: 4,
      offset: const Offset(0, 1),
    ),
  ];

  static List<BoxShadow> goins = [
    BoxShadow(
      color: MGColors.goinsGlow,
      blurRadius: 16,
      spreadRadius: 1,
    ),
  ];

  static List<BoxShadow> primary = [
    BoxShadow(
      color: MGColors.primary.withOpacity(0.28),
      blurRadius: 14,
      offset: const Offset(0, 4),
    ),
  ];

  static List<BoxShadow> nav = [
    BoxShadow(
      color: const Color(0xFF5B6EF5).withOpacity(0.12),
      blurRadius: 24,
      offset: const Offset(0, -4),
    ),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────

class MGGradients {
  MGGradients._();

  static const primaryBg = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFEEF0FF), Color(0xFFF5F7FF)],
  );

  static const heroCard = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF5B6EF5), Color(0xFF8B5CF6)],
  );

  static const coinCard = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFFF8E1), Color(0xFFFFF3CC)],
  );

  static const mintCard = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFD4F5EE), Color(0xFFEAFFF9)],
  );

  static const coralCard = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFFECEC), Color(0xFFFFF5F5)],
  );

  static LinearGradient categoryGradient(int index) {
    return LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        MGColors.categoryPaletteLight[index % MGColors.categoryPaletteLight.length],
        MGColors.categoryPaletteLight[index % MGColors.categoryPaletteLight.length]
            .withOpacity(0.4),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  AppTheme
// ─────────────────────────────────────────────────────────────────────────────

class AppTheme {
  AppTheme._();

  static TextTheme _buildTextTheme() {
    return TextTheme(
      // Display — Fredoka One: chunky playful headings
      displayLarge: GoogleFonts.nunito(fontWeight: FontWeight.w900, 
        fontSize: 36, color: MGColors.textPrimary, letterSpacing: -0.5,
      ),
      displayMedium: GoogleFonts.nunito(fontWeight: FontWeight.w900, 
        fontSize: 28, color: MGColors.textPrimary,
      ),
      displaySmall: GoogleFonts.nunito(fontWeight: FontWeight.w900, 
        fontSize: 22, color: MGColors.textPrimary,
      ),
      // Headlines — Nunito ExtraBold
      headlineLarge: GoogleFonts.nunito(
        fontSize: 24, fontWeight: FontWeight.w800, color: MGColors.textPrimary,
      ),
      headlineMedium: GoogleFonts.nunito(
        fontSize: 20, fontWeight: FontWeight.w800, color: MGColors.textPrimary,
      ),
      headlineSmall: GoogleFonts.nunito(
        fontSize: 16, fontWeight: FontWeight.w700, color: MGColors.textPrimary,
      ),
      // Body — Nunito
      bodyLarge: GoogleFonts.nunito(
        fontSize: 16, fontWeight: FontWeight.w500, color: MGColors.textPrimary,
      ),
      bodyMedium: GoogleFonts.nunito(
        fontSize: 14, fontWeight: FontWeight.w400, color: MGColors.textBody,
      ),
      bodySmall: GoogleFonts.nunito(
        fontSize: 12, fontWeight: FontWeight.w400, color: MGColors.textSecondary,
      ),
      labelLarge: GoogleFonts.nunito(
        fontSize: 14, fontWeight: FontWeight.w700, color: MGColors.textPrimary,
        letterSpacing: 0.2,
      ),
      labelMedium: GoogleFonts.nunito(
        fontSize: 12, fontWeight: FontWeight.w600, color: MGColors.textSecondary,
      ),
      labelSmall: GoogleFonts.nunito(
        fontSize: 10, fontWeight: FontWeight.w600, color: MGColors.textMuted,
        letterSpacing: 0.5,
      ),
    );
  }

  static ThemeData build() {
    final tt = _buildTextTheme();

    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,          // dark icons on light bg
      systemNavigationBarColor: Colors.white,
      systemNavigationBarIconBrightness: Brightness.dark,
    ));

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: MGColors.bg,

      colorScheme: const ColorScheme.light(
        primary:    MGColors.primary,
        secondary:  MGColors.mint,
        tertiary:   MGColors.goins,
        surface:    MGColors.bgCard,
        background: MGColors.bg,
        error:      MGColors.coral,
        onPrimary:  Colors.white,
        onSecondary: Colors.white,
        onSurface:  MGColors.textPrimary,
        onBackground: MGColors.textPrimary,
        onError:    Colors.white,
      ),

      textTheme: tt,
      primaryTextTheme: tt,

      // AppBar
      appBarTheme: AppBarTheme(
        backgroundColor: MGColors.bg,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        titleTextStyle: GoogleFonts.nunito(fontWeight: FontWeight.w900, 
          fontSize: 22, color: MGColors.textPrimary,
        ),
        iconTheme: const IconThemeData(color: MGColors.textPrimary),
        surfaceTintColor: Colors.transparent,
      ),

      // Bottom nav
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: MGColors.bgCard,
        selectedItemColor: MGColors.primary,
        unselectedItemColor: MGColors.textMuted,
        elevation: 0,
        type: BottomNavigationBarType.fixed,
        selectedLabelStyle: GoogleFonts.nunito(
          fontSize: 11, fontWeight: FontWeight.w700,
        ),
        unselectedLabelStyle: GoogleFonts.nunito(
          fontSize: 11, fontWeight: FontWeight.w500,
        ),
      ),

      // Card
      cardTheme: CardTheme(
        color: MGColors.bgCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(MGRadius.lg),
          side: const BorderSide(color: MGColors.border, width: 1),
        ),
        margin: EdgeInsets.zero,
        shadowColor: MGColors.primary.withOpacity(0.08),
      ),

      // Elevated button
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: MGColors.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(MGRadius.pill),
          ),
          textStyle: GoogleFonts.nunito(
            fontSize: 15, fontWeight: FontWeight.w700,
          ),
          shadowColor: MGColors.primary.withOpacity(0.3),
        ),
      ),

      // Outlined button
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: MGColors.primary,
          side: const BorderSide(color: MGColors.primary, width: 1.5),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(MGRadius.pill),
          ),
          textStyle: GoogleFonts.nunito(
            fontSize: 15, fontWeight: FontWeight.w700,
          ),
        ),
      ),

      // Text button
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: MGColors.primary,
          textStyle: GoogleFonts.nunito(
            fontSize: 14, fontWeight: FontWeight.w700,
          ),
        ),
      ),

      // Chip
      chipTheme: ChipThemeData(
        backgroundColor: MGColors.bgCardAlt,
        selectedColor: MGColors.primaryLight,
        disabledColor: MGColors.bgCardAlt,
        labelStyle: GoogleFonts.nunito(
          fontSize: 13, fontWeight: FontWeight.w600,
          color: MGColors.textSecondary,
        ),
        side: const BorderSide(color: MGColors.border),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(MGRadius.pill),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        elevation: 0,
      ),

      // Input / TextField
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: MGColors.bgCard,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(MGRadius.md),
          borderSide: const BorderSide(color: MGColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(MGRadius.md),
          borderSide: const BorderSide(color: MGColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(MGRadius.md),
          borderSide: const BorderSide(color: MGColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(MGRadius.md),
          borderSide: const BorderSide(color: MGColors.coral),
        ),
        hintStyle: GoogleFonts.nunito(
          color: MGColors.textMuted, fontSize: 14,
        ),
        labelStyle: GoogleFonts.nunito(
          color: MGColors.textSecondary, fontSize: 14,
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),

      // Divider
      dividerTheme: const DividerThemeData(
        color: MGColors.divider,
        thickness: 1,
        space: 1,
      ),

      // SnackBar
      snackBarTheme: SnackBarThemeData(
        backgroundColor: MGColors.textPrimary,
        contentTextStyle: GoogleFonts.nunito(
          color: Colors.white, fontSize: 14,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(MGRadius.md),
        ),
        behavior: SnackBarBehavior.floating,
        elevation: 4,
      ),

      // Bottom sheet
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: MGColors.bgCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(MGRadius.xl),
          ),
        ),
        elevation: 0,
      ),

      // ListTile
      listTileTheme: ListTileThemeData(
        tileColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(MGRadius.md),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: MGSpacing.md, vertical: MGSpacing.xs,
        ),
        titleTextStyle: GoogleFonts.nunito(
          fontSize: 15, fontWeight: FontWeight.w600,
          color: MGColors.textPrimary,
        ),
        subtitleTextStyle: GoogleFonts.nunito(
          fontSize: 13, color: MGColors.textSecondary,
        ),
      ),

      // Icon
      iconTheme: const IconThemeData(
        color: MGColors.textSecondary, size: 22,
      ),
      primaryIconTheme: const IconThemeData(
        color: MGColors.primary, size: 22,
      ),
    );
  }
}