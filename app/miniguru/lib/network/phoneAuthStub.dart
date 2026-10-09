// app/miniguru/lib/network/phoneAuthStub.dart — non-web builds.

Future<Map<String, dynamic>> phoneAuthStart(String configJson, String phone) async =>
    {'ok': false, 'error': 'Phone verification works in the MiniGuru web app.'};

Future<Map<String, dynamic>> phoneAuthConfirm(String code) async =>
    {'ok': false, 'error': 'Phone verification works in the MiniGuru web app.'};
