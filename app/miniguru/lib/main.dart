import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/screens/homeScreen.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:miniguru/screens/registerScreen.dart';
import 'package:miniguru/screens/splashScreen.dart';
import 'dart:html' as html;

void main() async {
  // Catch ALL errors
  FlutterError.onError = (FlutterErrorDetails details) {
    print('');
    print('=================================');
    print('❌ FLUTTER ERROR CAUGHT');
    print('=================================');
    print('Error: ${details.exception}');
    print('Stack trace: ${details.stack}');
    print('=================================');
    print('');
    
    // Also log to browser console
    html.window.console.error('FLUTTER ERROR: ${details.exception}');
  };

  try {
    WidgetsFlutterBinding.ensureInitialized();
    
    print('');
    print('=================================');
    print('🚀 MINIGURU APP STARTING');
    print('=================================');
    print('Time: ${DateTime.now()}');
    print('=================================');
    print('');
    
    runApp(const MyApp());
    
    print('✅ runApp() completed successfully');
    
  } catch (e, stackTrace) {
    print('');
    print('=================================');
    print('❌ FATAL ERROR IN main()');
    print('=================================');
    print('Error: $e');
    print('Type: ${e.runtimeType}');
    print('Stack trace: $stackTrace');
    print('=================================');
    print('');
    
    // Show error on screen
    runApp(MaterialApp(
      home: Scaffold(
        backgroundColor: Colors.red,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error, size: 100, color: Colors.white),
                const SizedBox(height: 20),
                const Text(
                  'Fatal Error in main()',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  e.toString(),
                  style: const TextStyle(color: Colors.white),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    ));
  }
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    print('📱 MyApp.build() called');
    
    try {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'MiniGuru',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: pastelBlue),
          useMaterial3: true,
        ),

        // Use onGenerateRoute for better control
        onGenerateRoute: (settings) {
          print('📍 Navigating to: ${settings.name}');
          
          try {
            // Handle root path
            if (settings.name == '/') {
              print('✅ Loading HomeScreen for route "/"');
              return MaterialPageRoute(builder: (_) => const HomeScreen());
            }
            
            // Handle named routes
            switch (settings.name) {
              case SplashScreen.id:
                print('✅ Loading SplashScreen');
                return MaterialPageRoute(builder: (_) => const SplashScreen());
              case LoginScreen.id:
                print('✅ Loading LoginScreen');
                return MaterialPageRoute(builder: (_) => const LoginScreen());
              case RegisterScreen.id:
                print('✅ Loading RegisterScreen');
                return MaterialPageRoute(builder: (_) => const RegisterScreen());
              case HomeScreen.id:
                print('✅ Loading HomeScreen');
                return MaterialPageRoute(builder: (_) => const HomeScreen());
              default:
                print('⚠️  Unknown route: ${settings.name}, using HomeScreen');
                return MaterialPageRoute(builder: (_) => const HomeScreen());
            }
          } catch (e, stackTrace) {
            print('');
            print('=================================');
            print('❌ ERROR IN onGenerateRoute');
            print('=================================');
            print('Route: ${settings.name}');
            print('Error: $e');
            print('Stack trace: $stackTrace');
            print('=================================');
            print('');
            
            // Return error screen
            return MaterialPageRoute(
              builder: (_) => Scaffold(
                backgroundColor: Colors.orange,
                body: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.warning, size: 100, color: Colors.white),
                        const SizedBox(height: 20),
                        const Text(
                          'Route Error',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          'Route: ${settings.name}\n\n$e',
                          style: const TextStyle(color: Colors.white),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          }
        },
        
        // Fallback for unknown routes
        onUnknownRoute: (settings) {
          print('⚠️  Unknown route: ${settings.name}, redirecting to home');
          return MaterialPageRoute(builder: (_) => const HomeScreen());
        },
      );
    } catch (e, stackTrace) {
      print('');
      print('=================================');
      print('❌ ERROR IN MyApp.build()');
      print('=================================');
      print('Error: $e');
      print('Stack trace: $stackTrace');
      print('=================================');
      print('');
      
      // Return error screen
      return MaterialApp(
        home: Scaffold(
          backgroundColor: Colors.purple,
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 100, color: Colors.white),
                  const SizedBox(height: 20),
                  const Text(
                    'Error in MyApp.build()',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    e.toString(),
                    style: const TextStyle(color: Colors.white),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }
  }
}