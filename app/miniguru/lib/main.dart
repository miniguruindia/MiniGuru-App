// lib/main.dart
import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/screens/homeScreen.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:miniguru/screens/registerScreen.dart';
import 'package:miniguru/screens/splashScreen.dart';
import 'package:miniguru/screens/getStartedScreen.dart';
import 'package:miniguru/screens/resetPasswordScreen.dart';
import 'package:miniguru/screens/legalScreen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  print('🚀 MiniGuru starting...');
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'MiniGuru',

      // ── NEW: full design system theme ──────────────────────────────────
      theme: AppTheme.build(),
      // ───────────────────────────────────────────────────────────────────

      initialRoute: SplashScreen.id,

      onGenerateRoute: (settings) {
        print('📍 Navigating to: ${settings.name}');

        // Password reset deep link — check the real browser URL directly
        // (Uri.base) since settings.name may not carry the query string
        // depending on URL strategy. Safe: only activates when a token
        // is actually present, otherwise falls through unchanged below.
        final browserUri = Uri.base;
        final resetToken = browserUri.queryParameters['token'];
        if (resetToken != null &&
            resetToken.isNotEmpty &&
            ((settings.name?.contains('reset-password') ?? false) ||
                browserUri.path.contains('reset-password'))) {
          return MaterialPageRoute(
              builder: (_) => ResetPasswordScreen(token: resetToken));
        }

        // Direct, bookmarkable legal-page links (miniguru.in/privacy,
        // miniguru.in/terms) — needed as real standalone URLs for external
        // reviewers (e.g. Google API access requests) who won't click
        // through in-app navigation. Same detection pattern as the
        // password-reset link above: check the real browser path directly
        // since settings.name doesn't always carry it depending on URL
        // strategy. Falls through unchanged if neither path matches.
        if (browserUri.path.contains('/privacy')) {
          return MaterialPageRoute(
              builder: (_) => const LegalScreen(initialTab: 0));
        }
        if (browserUri.path.contains('/terms')) {
          return MaterialPageRoute(
              builder: (_) => const LegalScreen(initialTab: 1));
        }

        switch (settings.name) {
          case SplashScreen.id:
            return MaterialPageRoute(builder: (_) => const SplashScreen());

          case GetStartedScreen.id:
            return MaterialPageRoute(builder: (_) => const GetStartedScreen());

          case LoginScreen.id:
            return MaterialPageRoute(builder: (_) => const LoginScreen());

          case RegisterScreen.id:
            return MaterialPageRoute(builder: (_) => const RegisterScreen());

          case HomeScreen.id:
            return MaterialPageRoute(builder: (_) => const HomeScreen());

          case '/':
            return MaterialPageRoute(builder: (_) => const SplashScreen());

          default:
            print('⚠️  Unknown route: ${settings.name}, redirecting to splash');
            return MaterialPageRoute(builder: (_) => const SplashScreen());
        }
      },

      onUnknownRoute: (settings) {
        print('⚠️  Unknown route: ${settings.name}, redirecting to splash');
        return MaterialPageRoute(builder: (_) => const SplashScreen());
      },
    );
  }
}