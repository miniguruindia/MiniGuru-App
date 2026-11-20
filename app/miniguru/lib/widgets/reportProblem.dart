// "Report a problem" (Nov 2026): a small box where anyone can describe what went wrong. It emails the MiniGuru team
// with the person's name, the page, and the phone/browser. Works logged in or not.
import 'package:flutter/material.dart' hide Text;
import 'package:miniguru/widgets/mgText.dart';
import 'package:miniguru/network/MiniguruApi.dart';

Future<void> showReportProblemDialog(BuildContext context, {String page = ''}) {
  final ctrl = TextEditingController();
  bool sending = false;
  String? error;
  return showDialog<void>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setS) => AlertDialog(
        title: const Text('Report a problem'),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Tell us what went wrong. What did you tap, and what happened?'),
            const SizedBox(height: 10),
            TextField(
              controller: ctrl,
              maxLines: 5,
              maxLength: 2000,
              enabled: !sending,
              decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'Write here...'),
            ),
            if (error != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(error!, style: const TextStyle(color: Colors.red))),
          ]),
        ),
        actions: [
          TextButton(onPressed: sending ? null : () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: sending
                ? null
                : () async {
                    final msg = ctrl.text.trim();
                    if (msg.length < 5) {
                      setS(() => error = 'Please tell us a little more.');
                      return;
                    }
                    setS(() { sending = true; error = null; });
                    final err = await MiniguruApi().reportProblem(msg, page);
                    if (!ctx.mounted) return;
                    if (err == null) {
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Thank you! We got your report and will look into it. 🙏')),
                      );
                    } else {
                      setS(() { sending = false; error = err; });
                    }
                  },
            child: Text(sending ? 'Sending...' : 'Send'),
          ),
        ],
      ),
    ),
  );
}
