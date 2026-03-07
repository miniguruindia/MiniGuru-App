// lib/main.dart
import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/screens/homeScreen.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:miniguru/screens/registerScreen.dart';
import 'package:miniguru/screens/splashScreen.dart';
import 'package:miniguru/screens/getStartedScreen.dart';

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