import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/screens/homeScreen.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:miniguru/screens/registerScreen.dart';
import 'package:miniguru/screens/splashScreen.dart';

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
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: pastelBlue),
        useMaterial3: true,
      ),

      // Start with splash screen
      initialRoute: SplashScreen.id,

      // Route generator
      onGenerateRoute: (settings) {
        print('📍 Navigating to: ${settings.name}');
        
        switch (settings.name) {
          case SplashScreen.id:
            return MaterialPageRoute(builder: (_) => const SplashScreen());
          
          case LoginScreen.id:
            return MaterialPageRoute(builder: (_) => const LoginScreen());
          
          case RegisterScreen.id:
            return MaterialPageRoute(builder: (_) => const RegisterScreen());
          
          case HomeScreen.id:
            return MaterialPageRoute(builder: (_) => const HomeScreen());
          
          // Default route
          case '/':
            return MaterialPageRoute(builder: (_) => const SplashScreen());
          
          default:
            print('⚠️  Unknown route: ${settings.name}, redirecting to splash');
            return MaterialPageRoute(builder: (_) => const SplashScreen());
        }
      },
      
      // Fallback for unknown routes
      onUnknownRoute: (settings) {
        print('⚠️  Unknown route: ${settings.name}, redirecting to splash');
        return MaterialPageRoute(builder: (_) => const SplashScreen());
      },
    );
  }
}