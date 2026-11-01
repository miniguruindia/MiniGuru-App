// Simple drawing pad for the planning sheet (Nov 2026). Works with finger, pen or mouse.
// Returns PNG bytes (640x480, white paper) or null if cancelled.
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

Future<Uint8List?> showSketchPad(BuildContext context, {Uint8List? background}) {
  return Navigator.of(context).push<Uint8List>(
    MaterialPageRoute(fullscreenDialog: true, builder: (_) => _SketchPad(background: background)),
  );
}

class _Stroke {
  final Color color;
  final double width;
  final List<Offset> pts;
  _Stroke(this.color, this.width, this.pts);
}

class _SketchPad extends StatefulWidget {
  final Uint8List? background;
  const _SketchPad({this.background});
  @override
  State<_SketchPad> createState() => _SketchPadState();
}

class _SketchPadState extends State<_SketchPad> {
  static const _w = 640.0, _h = 480.0;
  final List<_Stroke> _strokes = [];
  Color _color = const Color(0xFF1A1A2E);
  double _width = 4;
  bool _eraser = false;
  ui.Image? _bg;
  Size _box = const Size(_w, _h);

  static const _colors = [
    Color(0xFF1A1A2E), Color(0xFFE53935), Color(0xFF0A6CFF), Color(0xFF12B24A),
    Color(0xFFFFB800), Color(0xFF8E24AA), Color(0xFF6D4C41),
  ];

  @override
  void initState() {
    super.initState();
    if (widget.background != null) {
      ui.instantiateImageCodec(widget.background!, targetWidth: _w.toInt()).then((c) => c.getNextFrame()).then((f) {
        if (mounted) setState(() => _bg = f.image);
      }).catchError((_) {});
    }
  }

  Offset _norm(Offset p) => Offset(p.dx / _box.width * _w, p.dy / _box.height * _h);

  Future<void> _done() async {
    final rec = ui.PictureRecorder();
    final c = Canvas(rec, const Rect.fromLTWH(0, 0, _w, _h));
    _paint(c, const Size(_w, _h), 1);
    final img = await rec.endRecording().toImage(_w.toInt(), _h.toInt());
    final bd = await img.toByteData(format: ui.ImageByteFormat.png);
    if (!mounted) return;
    Navigator.of(context).pop(bd?.buffer.asUint8List());
  }

  void _paint(Canvas c, Size size, double scale) {
    c.drawRect(Offset.zero & size, Paint()..color = Colors.white);
    if (_bg != null) {
      final src = Rect.fromLTWH(0, 0, _bg!.width.toDouble(), _bg!.height.toDouble());
      final k = (size.width / src.width).clamp(0.0, size.height / src.height);
      final dst = Rect.fromLTWH(0, 0, src.width * k, src.height * k);
      c.drawImageRect(_bg!, src, dst, Paint());
    }
    for (final s in _strokes) {
      final p = Paint()
        ..color = s.color
        ..strokeWidth = s.width
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke;
      if (s.pts.length == 1) {
        c.drawCircle(s.pts.first, s.width / 2, p..style = PaintingStyle.fill);
      } else {
        final path = Path()..moveTo(s.pts.first.dx, s.pts.first.dy);
        for (final o in s.pts.skip(1)) {
          path.lineTo(o.dx, o.dy);
        }
        c.drawPath(path, p);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFE3EEFF),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A6CFF),
        foregroundColor: Colors.white,
        title: Text('✏️ Draw your idea', style: GoogleFonts.nunito(fontWeight: FontWeight.w900)),
        actions: [
          IconButton(
            tooltip: 'Undo',
            icon: const Icon(Icons.undo),
            onPressed: _strokes.isEmpty ? null : () => setState(() => _strokes.removeLast()),
          ),
          IconButton(
            tooltip: 'Clear all',
            icon: const Icon(Icons.delete_outline),
            onPressed: _strokes.isEmpty ? null : () => setState(() => _strokes.clear()),
          ),
          TextButton(
            onPressed: _done,
            child: Text('Done', style: GoogleFonts.nunito(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16)),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(children: [
          Expanded(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: AspectRatio(
                  aspectRatio: _w / _h,
                  child: LayoutBuilder(builder: (context, cons) {
                    _box = Size(cons.maxWidth, cons.maxHeight);
                    return ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: GestureDetector(
                        onPanStart: (d) => setState(() => _strokes.add(_Stroke(
                            _eraser ? Colors.white : _color, _eraser ? 20 : _width, [_norm(d.localPosition)]))),
                        onPanUpdate: (d) => setState(() => _strokes.last.pts.add(_norm(d.localPosition))),
                        onTapDown: (d) => setState(() => _strokes.add(_Stroke(
                            _eraser ? Colors.white : _color, _eraser ? 20 : _width, [_norm(d.localPosition)]))),
                        child: CustomPaint(
                          size: Size.infinite,
                          painter: _PadPainter((c, s) {
                            c.save();
                            c.scale(s.width / _w, s.height / _h);
                            _paint(c, const Size(_w, _h), 1);
                            c.restore();
                          }, _strokes.length, _bg),
                        ),
                      ),
                    );
                  }),
                ),
              ),
            ),
          ),
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              runSpacing: 6,
              children: [
                for (final col in _colors)
                  GestureDetector(
                    onTap: () => setState(() { _color = col; _eraser = false; }),
                    child: Container(
                      width: 30, height: 30,
                      decoration: BoxDecoration(
                        color: col,
                        shape: BoxShape.circle,
                        border: Border.all(color: (!_eraser && _color == col) ? Colors.black : Colors.black12, width: 3),
                      ),
                    ),
                  ),
                ChoiceChip(
                  label: Text('Rubber', style: GoogleFonts.nunito(fontWeight: FontWeight.w800)),
                  selected: _eraser,
                  onSelected: (v) => setState(() => _eraser = v),
                ),
                SizedBox(
                  width: 130,
                  child: Slider(
                    min: 2, max: 14, value: _width,
                    onChanged: (v) => setState(() { _width = v; _eraser = false; }),
                  ),
                ),
              ],
            ),
          ),
        ]),
      ),
    );
  }
}

class _PadPainter extends CustomPainter {
  final void Function(Canvas, Size) draw;
  final int n;
  final ui.Image? bg;
  _PadPainter(this.draw, this.n, this.bg);
  @override
  void paint(Canvas canvas, Size size) => draw(canvas, size);
  @override
  bool shouldRepaint(covariant _PadPainter old) => true;
}
