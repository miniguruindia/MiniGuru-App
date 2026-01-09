import 'dart:async';
import 'package:flutter/material.dart';
import 'package:miniguru/constants.dart';
import 'package:miniguru/database/database_helper.dart';
import 'package:miniguru/network/MiniguruApi.dart';
import 'package:miniguru/screens/homeScreen.dart';
import 'package:miniguru/screens/loginScreen.dart';
import 'package:google_fonts/google_fonts.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  static const String id = "SplashScreen";

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late MiniguruApi _api;
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;
  String _statusText = 'Initializing...';

  @override
  void initState() {
    super.initState();
    _api = MiniguruApi();
    
    // Setup animations
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1200),
      vsync: this,
    );
    
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeIn),
    );
    
    _scaleAnimation = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutBack),
    );
    
    _controller.forward();
    
    // Check authentication
    _checkAuthToken();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _checkAuthToken() async {
    try {
      setState(() => _statusText = 'Loading amazing projects...');
      
      // Minimum splash display time: 2.5 seconds
      final splashStart = DateTime.now();
      
      var dbHelper = DatabaseHelper();
      var authToken = await dbHelper.getAuthToken();
      var hasTokenExpired = await dbHelper.hasTokenExpired();

      // Check if user is authenticated (but don't navigate to login)
      if (authToken != null) {
        if (hasTokenExpired) {
          setState(() => _statusText = 'Refreshing session...');
          try {
            authToken = await _api.refreshToken();
            setState(() => _statusText = 'Welcome back!');
          } catch (e) {
            print('Token refresh failed: $e');
            setState(() => _statusText = 'Loading...');
          }
        } else {
          setState(() => _statusText = 'Welcome back!');
        }
      } else {
        setState(() => _statusText = 'Discover STEM projects!');
      }
      
      // Ensure minimum 2.5 seconds splash time
      final elapsed = DateTime.now().difference(splashStart);
      final remaining = const Duration(milliseconds: 2500) - elapsed;
      
      if (remaining.inMilliseconds > 0) {
        await Future.delayed(remaining);
      }
      
      // ALWAYS navigate to HomeScreen (not LoginScreen)
      // User can login from the home page if needed
      if (mounted) {
        Navigator.pushReplacementNamed(context, HomeScreen.id);
      }
    } catch (e) {
      print('❌ Splash screen error: $e');
      setState(() => _statusText = 'Loading...');
      
      // Still show splash for minimum 2 seconds
      await Future.delayed(const Duration(milliseconds: 2000));
      
      // Always go to home
      if (mounted) {
        Navigator.pushReplacementNamed(context, HomeScreen.id);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFF667eea), // Purple
              const Color(0xFF764ba2), // Deep purple
              pastelBlue,
            ],
          ),
        ),
        child: SafeArea(
          child: Stack(
            children: [
              // Animated background circles
              Positioned(
                top: -50,
                right: -50,
                child: FadeTransition(
                  opacity: _fadeAnimation,
                  child: Container(
                    width: 200,
                    height: 200,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withOpacity(0.1),
                    ),
                  ),
                ),
              ),
              Positioned(
                bottom: -80,
                left: -80,
                child: FadeTransition(
                  opacity: _fadeAnimation,
                  child: Container(
                    width: 300,
                    height: 300,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withOpacity(0.08),
                    ),
                  ),
                ),
              ),
              
              // Main content
              Center(
                child: FadeTransition(
                  opacity: _fadeAnimation,
                  child: ScaleTransition(
                    scale: _scaleAnimation,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Logo Container with glow effect
                        Container(
                          width: 150,
                          height: 150,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(40),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.white.withOpacity(0.3),
                                blurRadius: 40,
                                spreadRadius: 10,
                              ),
                              BoxShadow(
                                color: pastelBlue.withOpacity(0.5),
                                blurRadius: 60,
                                spreadRadius: 15,
                              ),
                            ],
                          ),
                          padding: const EdgeInsets.all(30),
                          child: Image.asset(
                            'assets/mg-logo.png',
                            fit: BoxFit.contain,
                            errorBuilder: (context, error, stackTrace) {
                              return Image.asset(
                                'assets/ic_logo.png',
                                fit: BoxFit.contain,
                                errorBuilder: (context, error2, stackTrace2) {
                                  return const Icon(
                                    Icons.science,
                                    size: 70,
                                    color: pastelBlueText,
                                  );
                                },
                              );
                            },
                          ),
                        ),
                        
                        const SizedBox(height: 50),
                        
                        // App Name with gradient
                        ShaderMask(
                          shaderCallback: (bounds) => const LinearGradient(
                            colors: [
                              Colors.white,
                              Color(0xFFE3F2FD),
                            ],
                          ).createShader(bounds),
                          child: Text(
                            'MiniGuru',
                            style: GoogleFonts.poppins(
                              fontSize: 48,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              letterSpacing: 2,
                              height: 1,
                            ),
                          ),
                        ),
                        
                        const SizedBox(height: 12),
                        
                        // Tagline with subtle animation
                        Text(
                          'Where Young Minds Innovate',
                          style: GoogleFonts.poppins(
                            fontSize: 16,
                            color: Colors.white.withOpacity(0.9),
                            fontWeight: FontWeight.w500,
                            letterSpacing: 0.5,
                          ),
                        ),
                        
                        const SizedBox(height: 70),
                        
                        // Animated loading dots
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            _buildLoadingDot(0),
                            const SizedBox(width: 8),
                            _buildLoadingDot(1),
                            const SizedBox(width: 8),
                            _buildLoadingDot(2),
                          ],
                        ),
                        
                        const SizedBox(height: 25),
                        
                        // Status Text with fade animation
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 400),
                          child: Text(
                            _statusText,
                            key: ValueKey<String>(_statusText),
                            style: GoogleFonts.poppins(
                              fontSize: 14,
                              color: Colors.white.withOpacity(0.8),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              
              // Footer
              Positioned(
                bottom: 40,
                left: 0,
                right: 0,
                child: FadeTransition(
                  opacity: _fadeAnimation,
                  child: Text(
                    'Innovation Starts Here ✨',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.poppins(
                      fontSize: 12,
                      color: Colors.white.withOpacity(0.7),
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLoadingDot(int index) {
    return TweenAnimationBuilder(
      duration: const Duration(milliseconds: 600),
      tween: Tween<double>(begin: 0, end: 1),
      builder: (context, double value, child) {
        return Transform.translate(
          offset: Offset(0, -10 * (value > 0.5 ? 1 - value : value) * 2),
          child: Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white.withOpacity(0.9),
              boxShadow: [
                BoxShadow(
                  color: Colors.white.withOpacity(0.5),
                  blurRadius: 8,
                  spreadRadius: 2,
                ),
              ],
            ),
          ),
        );
      },
      onEnd: () {
        if (mounted) {
          Future.delayed(Duration(milliseconds: 200 * index), () {
            if (mounted) setState(() {});
          });
        }
      },
    );
  }
}