# Keep MainActivity
-keep class com.miniguru.app.MainActivity { *; }
-keep class com.miniguru.app.** { *; }

# Flutter
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-keep class io.flutter.embedding.** { *; }
-dontwarn io.flutter.embedding.**

# Keep Activities
-keep public class * extends android.app.Activity
-keep public class * extends io.flutter.embedding.android.FlutterActivity

# Razorpay
-keepattributes JavascriptInterface
-keep class com.razorpay.** {*;}

# InAppWebView
-keep class com.pichillilorenzo.flutter_inappwebview.** { *; }

# YouTube Player
-keep class com.pierfrancescosoffritti.** { *; }

# Native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# No obfuscation
-dontobfuscate
-dontoptimize
-keepattributes SourceFile,LineNumberTable
