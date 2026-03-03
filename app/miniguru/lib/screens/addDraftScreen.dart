// lib/screens/addDraftScreen.dart
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:miniguru/models/MaterialItem.dart';
import 'package:miniguru/models/ProjectCategory.dart';
import 'package:miniguru/repository/draftsRepository.dart';
import 'package:miniguru/repository/projectRepository.dart';
import 'package:miniguru/repository/GoinsRepository.dart';
import 'package:miniguru/widgets/material_picker_widget.dart';
import 'package:miniguru/widgets/goins_wallet_widget.dart';
import 'package:permission_handler/permission_handler.dart';
import 'homeScreen.dart';

const _blue      = Color(0xFF3B82F6);
const _navy      = Color(0xFF1E3A8A);
const _green     = Color(0xFF10B981);
const _amber     = Color(0xFFF59E0B);
const _red       = Color(0xFFEF4444);
const _purple    = Color(0xFF8B5CF6);
const _bgDark    = Color(0xFF0F172A);
const _card      = Color(0xFF1E293B);
const _cardLight = Color(0xFF334155);

class AddDraftScreen extends StatefulWidget {
  final int? draftId;
  const AddDraftScreen({super.key, this.draftId});
  @override
  State<AddDraftScreen> createState() => _AddDraftScreenState();
}

class _AddDraftScreenState extends State<AddDraftScreen> with TickerProviderStateMixin {
  final _formKey   = GlobalKey<FormState>();
  final _draftRepo = DraftRepository();
  final _goinsRepo = GoinsRepository();
  final _picker    = ImagePicker();

  List<String>         _categories          = [];
  List<PickedMaterial> _pickedMaterials      = [];
  int                  _currentGoinsBalance  = 0;
  bool                 _goinsLoading         = true;
  bool                 _loading              = true;
  bool                 _submitting           = false;
  int                  _draftId              = -1;
  DateTime?            _startDate;
  DateTime?            _endDate;
  XFile?               _video;
  XFile?               _thumbnail;

  final _titleCtrl    = TextEditingController();
  final _descCtrl     = TextEditingController();
  final _categoryCtrl = TextEditingController();

  late final AnimationController _fadeCtrl = AnimationController(
    vsync: this, duration: const Duration(milliseconds: 500));

  static const _defaultCategories = ['Robotics', 'Mechanics', 'ArtCraft', 'Science'];

  int  get _totalGoins => _pickedMaterials.fold(0, (s, m) => s + m.totalGoins);
  int  get _goinsAfter => _currentGoinsBalance - _totalGoins;
  bool get _overBudget => _goinsAfter < 0;

  @override
  void initState() {
    super.initState();
    if (widget.draftId != null && widget.draftId! > 0) _draftId = widget.draftId!;
    _loadInitialData();
  }

  @override
  void dispose() {
    _titleCtrl.dispose(); _descCtrl.dispose(); _categoryCtrl.dispose();
    _fadeCtrl.dispose(); super.dispose();
  }

  Future<void> _loadInitialData() async {
    await Future.wait([
      _loadCategories().catchError((_) {
        if (mounted) setState(() { _categories = _defaultCategories; _loading = false; });
      }),
      _loadGoinsBalance().catchError((_) {
        if (mounted) setState(() { _currentGoinsBalance = 500; _goinsLoading = false; });
      }),
      if (_draftId > 0) _loadExistingDraft(_draftId),
    ]);
    if (mounted) _fadeCtrl.forward();
  }

  Future<void> _loadGoinsBalance() async {
    final b = await _goinsRepo.getGoinsBalance();
    if (mounted) setState(() { _currentGoinsBalance = b; _goinsLoading = false; });
  }

  Future<void> _loadCategories() async {
    try {
      final cats  = await ProjectRepository().getProjectCategories();
      final names = cats.map((c) => c.name).toList();
      if (mounted) setState(() { _categories = names.isNotEmpty ? names : _defaultCategories; _loading = false; });
    } catch (_) {
      if (mounted) setState(() { _categories = _defaultCategories; _loading = false; });
    }
  }

  Future<void> _loadExistingDraft(int id) async {
    try {
      final draft = await _draftRepo.getDraftById(id);
      if (draft == null || !mounted) return;
      _titleCtrl.text    = draft.title;
      _descCtrl.text     = draft.description;
      _categoryCtrl.text = draft.category;
      _startDate         = draft.startDate;
      _endDate           = draft.endDate;
      if (draft.materials.isNotEmpty) {
        final all    = await _goinsRepo.getMaterials();
        final picked = <PickedMaterial>[];
        draft.materials.forEach((id, qty) {
          try { picked.add(PickedMaterial(item: all.firstWhere((m) => m.id == id), quantity: qty)); }
          catch (_) {}
        });
        if (mounted) setState(() => _pickedMaterials = picked);
      }
      if (mounted) setState(() {});
    } catch (e) { debugPrint('load draft error: $e'); }
  }

  // ── VIDEO PICKER — works on web + mobile ─────────────────
  Future<void> _pickVideo() async {
    try {
      if (kIsWeb) {
        final result = await FilePicker.platform.pickFiles(
          type: FileType.video, allowMultiple: false,
          withData: false, withReadStream: true);
        if (result != null && result.files.isNotEmpty) {
          final f = result.files.first;
          final chunks = await f.readStream!.expand((x) => x).toList();
          final bytes = Uint8List.fromList(chunks);
          setState(() => _video = XFile.fromData(bytes, name: f.name, mimeType: 'video/mp4'));
          _showSnack('Video selected: ' + f.name);
        }
      } else {
        await [Permission.storage].request();
        final f = await _picker.pickVideo(source: ImageSource.gallery);
        if (f != null) setState(() => _video = f);
      }
    } catch (e) { _showSnack('Could not pick video: $e', isError: true); }
  }

  Future<void> _pickThumbnail() async {
    try {
      if (kIsWeb) {
        final result = await FilePicker.platform.pickFiles(
          type: FileType.image, allowMultiple: false,
          withData: false, withReadStream: true);
        if (result != null && result.files.isNotEmpty) {
          final f = result.files.first;
          final chunks2 = await f.readStream!.expand((x) => x).toList();
          final bytes2 = Uint8List.fromList(chunks2);
          setState(() => _thumbnail = XFile.fromData(bytes2, name: f.name, mimeType: 'image/jpeg'));
        }
      } else {
        await [Permission.storage].request();
        final f = await _picker.pickImage(source: ImageSource.gallery);
        if (f != null) setState(() => _thumbnail = f);
      }
    } catch (e) { _showSnack('Could not pick image: $e', isError: true); }
  }

  Future<void> _pickDate(bool isStart) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: (isStart ? _startDate : _endDate) ?? DateTime.now(),
      firstDate: DateTime(2000), lastDate: DateTime(2101),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(colorScheme: const ColorScheme.dark(primary: _blue, surface: _card, onSurface: Colors.white)),
        child: child!,
      ),
    );
    if (picked != null) setState(() => isStart ? _startDate = picked : _endDate = picked);
  }

  Future<void> _openMaterialPicker() async {
    final result = await showMaterialPicker(
      context: context, currentGoinsBalance: _currentGoinsBalance, existingPicked: _pickedMaterials);
    if (result != null) setState(() => _pickedMaterials = result);
  }

  String? _validateDraft() {
    if (_titleCtrl.text.trim().isEmpty)    return 'Title is required.';
    if (_categoryCtrl.text.trim().isEmpty) return 'Category is required.';
    if (_descCtrl.text.trim().isEmpty)     return 'Description is required.';
    return null;
  }

  String? _validateFinal() {
    final d = _validateDraft(); if (d != null) return d;
    if (_startDate == null)  return 'Start date is required.';
    if (_endDate == null)    return 'End date is required.';
    if (_video == null)      return 'Please pick a project video.';
    if (_thumbnail == null)  return 'Please pick a thumbnail image.';
    return null;
  }

  Future<void> _handleSubmit({required bool isDraft}) async {
    final error = isDraft ? _validateDraft() : _validateFinal();
    if (error != null) { _showSnack(error, isError: true); return; }
    if (!isDraft && _overBudget) { _showSnack('Not enough Goines!', isError: true); return; }

    final materialsMap = {for (final m in _pickedMaterials) m.item.id: m.quantity};

    if (isDraft) {
      _draftId = await _draftRepo.saveOrUpdateDraft(
        id: _draftId > 0 ? _draftId : null,
        title: _titleCtrl.text, description: _descCtrl.text,
        category: _categoryCtrl.text, startDate: _startDate, endDate: _endDate, materials: materialsMap,
      );
      _showSnack('Saved as draft! ✅');
      if (mounted) Navigator.pushNamedAndRemoveUntil(context, HomeScreen.id, (r) => false);
      return;
    }

    setState(() => _submitting = true);
    showDialog(context: context, barrierDismissible: false, builder: (_) => const _UploadingDialog());

    try {
      final statusCode = await _draftRepo.uploadProjects(
        {'title': _titleCtrl.text, 'description': _descCtrl.text,
         'startDate': _startDate, 'endDate': _endDate,
         'category': _categoryCtrl.text, 'materials': materialsMap},
        _video!, _thumbnail!,
      );
      if (mounted) Navigator.pop(context);

      if (statusCode == 201) {
        if (_pickedMaterials.isNotEmpty) {
          final pid = 'proj_${DateTime.now().millisecondsSinceEpoch}';
          final ded = await _goinsRepo.deductForMaterials(projectId: pid, pickedMaterials: _pickedMaterials);
          if (ded.success) setState(() => _currentGoinsBalance = ded.newBalance);
          final aw  = await _goinsRepo.awardForVideoUpload(projectId: pid);
          if (aw.success && mounted) {
            await showGoinsAwardPopup(context: context, awarded: aw.awarded, newBalance: aw.newBalance,
              reason: 'You earned 2× your material cost back for uploading! 🎬');
          }
        }
        if (_draftId > 0) await _draftRepo.deleteDraft(_draftId);
        _showSnack('Project submitted! 🚀');
        if (mounted) Navigator.pushNamedAndRemoveUntil(context, HomeScreen.id, (r) => false);
      } else {
        _showSnack('Upload failed. Please try again.', isError: true);
      }
    } catch (e) {
      if (mounted) Navigator.pop(context);
      _showSnack('Error: $e', isError: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _showSnack(String msg, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: GoogleFonts.poppins(color: Colors.white, fontSize: 13)),
      backgroundColor: isError ? _red : _green,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      margin: const EdgeInsets.all(12),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: _bgDark,
        appBar: _buildAppBar(),
        body: _loading
            ? const Center(child: CircularProgressIndicator(color: _blue))
            : FadeTransition(
                opacity: _fadeCtrl,
                child: Form(
                  key: _formKey,
                  child: CustomScrollView(slivers: [
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                      sliver: SliverList(delegate: SliverChildListDelegate([
                        _section(emoji: '📋', title: 'Project Details', child: _buildDetails()),
                        const SizedBox(height: 12),
                        _section(emoji: '📅', title: 'Timeline',        child: _buildTimeline()),
                        const SizedBox(height: 12),
                        _section(emoji: '🎬', title: 'Media',           child: _buildMedia()),
                        const SizedBox(height: 12),
                        _buildMaterials(),
                      ])),
                    ),
                  ]),
                ),
              ),
        bottomNavigationBar: _buildBottomBar(),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() => AppBar(
    backgroundColor: _navy, elevation: 0,
    leading: IconButton(
      icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 18),
      onPressed: () => Navigator.pop(context)),
    title: Text(_draftId > 0 ? 'Edit Draft' : 'New Project',
      style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 17)),
    actions: [Padding(
      padding: const EdgeInsets.only(right: 14),
      child: _goinsLoading
          ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white38, strokeWidth: 2))
          : GoinsBalanceBadge(balance: _currentGoinsBalance),
    )],
  );

  Widget _section({required String emoji, required String title, required Widget child}) =>
    Container(
      decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.06))),
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(emoji, style: const TextStyle(fontSize: 16)), const SizedBox(width: 8),
          Text(title, style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
        ]),
        const SizedBox(height: 14), child,
      ]),
    );

  Widget _buildDetails() => Column(children: [
    _field(ctrl: _titleCtrl,  label: 'Title',       hint: 'What did you build?',                        icon: Icons.title_rounded),
    const SizedBox(height: 12),
    _field(ctrl: _descCtrl,   label: 'Description', hint: 'Describe your project and what you learned...', icon: Icons.description_rounded, maxLines: 3),
    const SizedBox(height: 12),
    _buildCategoryDropdown(),
  ]);

  Widget _field({required TextEditingController ctrl, required String label, required String hint, required IconData icon, int maxLines = 1}) =>
    TextFormField(
      controller: ctrl, maxLines: maxLines,
      style: GoogleFonts.poppins(color: Colors.white, fontSize: 14), cursorColor: _blue,
      decoration: InputDecoration(
        labelText: label, hintText: hint,
        labelStyle: GoogleFonts.poppins(color: Colors.white54, fontSize: 13),
        hintStyle:  GoogleFonts.poppins(color: Colors.white24, fontSize: 13),
        prefixIcon: Icon(icon, color: Colors.white38, size: 18),
        filled: true, fillColor: _bgDark,
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: _cardLight.withOpacity(0.6))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _blue)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );

  Widget _buildCategoryDropdown() => DropdownButtonFormField<String>(
    value: (_categoryCtrl.text.isNotEmpty && _categories.contains(_categoryCtrl.text)) ? _categoryCtrl.text : null,
    dropdownColor: _card,
    style: GoogleFonts.poppins(color: Colors.white, fontSize: 14),
    icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Colors.white38),
    decoration: InputDecoration(
      labelText: 'Category',
      labelStyle: GoogleFonts.poppins(color: Colors.white54, fontSize: 13),
      prefixIcon: const Icon(Icons.category_rounded, color: Colors.white38, size: 18),
      filled: true, fillColor: _bgDark,
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: _cardLight.withOpacity(0.6))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: _blue)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    ),
    items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(c, style: GoogleFonts.poppins(color: Colors.white, fontSize: 14)))).toList(),
    onChanged: (v) => setState(() => _categoryCtrl.text = v ?? ''),
  );

  Widget _buildTimeline() => Row(children: [
    Expanded(child: _dateTile('Start Date', _startDate, () => _pickDate(true))),
    const SizedBox(width: 10),
    const Icon(Icons.arrow_forward_rounded, color: Colors.white24, size: 18),
    const SizedBox(width: 10),
    Expanded(child: _dateTile('End Date',   _endDate,   () => _pickDate(false))),
  ]);

  Widget _dateTile(String label, DateTime? date, VoidCallback onTap) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      decoration: BoxDecoration(
        color: _bgDark, borderRadius: BorderRadius.circular(12),
        border: Border.all(color: date != null ? _blue.withOpacity(0.5) : _cardLight.withOpacity(0.6))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: GoogleFonts.poppins(color: Colors.white38, fontSize: 10)),
        const SizedBox(height: 4),
        Row(children: [
          Icon(Icons.calendar_today_rounded, size: 13, color: date != null ? _blue : Colors.white24),
          const SizedBox(width: 6),
          Text(
            date != null ? '${date.day}/${date.month}/${date.year}' : 'Pick date',
            style: GoogleFonts.poppins(color: date != null ? Colors.white : Colors.white38,
              fontSize: 12, fontWeight: date != null ? FontWeight.w600 : FontWeight.normal),
          ),
        ]),
      ]),
    ),
  );

  Widget _buildMedia() => Column(children: [
    _mediaTile(Icons.video_library_rounded, 'Project Video',
      _video != null ? '✅ ${_video!.name}' : 'Tap to pick a video file',
      _video != null, _pickVideo, _purple),
    const SizedBox(height: 10),
    _mediaTile(Icons.image_rounded, 'Thumbnail Image',
      _thumbnail != null ? '✅ ${_thumbnail!.name}' : 'Tap to pick an image',
      _thumbnail != null, _pickThumbnail, _green),
  ]);

  Widget _mediaTile(IconData icon, String label, String sub, bool hasFile, VoidCallback onTap, Color accent) =>
    GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _bgDark, borderRadius: BorderRadius.circular(12),
          border: Border.all(color: hasFile ? accent.withOpacity(0.6) : _cardLight.withOpacity(0.6))),
        child: Row(children: [
          Container(width: 44, height: 44,
            decoration: BoxDecoration(color: accent.withOpacity(0.15), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: accent, size: 22)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: GoogleFonts.poppins(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
            Text(sub,   style: GoogleFonts.poppins(color: hasFile ? accent : Colors.white38, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
          ])),
          Icon(hasFile ? Icons.check_circle_rounded : Icons.add_circle_outline_rounded,
            color: hasFile ? accent : Colors.white24, size: 22),
        ]),
      ),
    );

  Widget _buildMaterials() => Container(
    decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(16),
      border: Border.all(color: _pickedMaterials.isNotEmpty ? _blue.withOpacity(0.3) : Colors.white.withOpacity(0.06))),
    padding: const EdgeInsets.all(16),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Row(children: [
          const Text('🧰', style: TextStyle(fontSize: 16)), const SizedBox(width: 8),
          Text('Materials', style: GoogleFonts.poppins(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
        ]),
        if (_pickedMaterials.isNotEmpty) Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: (_overBudget ? _red : _amber).withOpacity(0.15), borderRadius: BorderRadius.circular(20),
            border: Border.all(color: (_overBudget ? _red : _amber).withOpacity(0.4))),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Text(_overBudget ? '⛔' : '💸', style: const TextStyle(fontSize: 12)),
            const SizedBox(width: 4),
            Text('$_totalGoins G', style: GoogleFonts.poppins(color: _overBudget ? _red : _amber, fontSize: 12, fontWeight: FontWeight.bold)),
          ]),
        ),
      ]),
      const SizedBox(height: 12),
      if (_pickedMaterials.isNotEmpty) ...[
        Wrap(spacing: 8, runSpacing: 6,
          children: _pickedMaterials.map((p) => _MaterialChip(picked: p,
            onRemove: () => setState(() => _pickedMaterials.remove(p)))).toList()),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: (_overBudget ? _red : _green).withOpacity(0.08), borderRadius: BorderRadius.circular(10),
            border: Border.all(color: (_overBudget ? _red : _green).withOpacity(0.2))),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            _stat('My Balance',  '$_currentGoinsBalance G', Colors.white60),
            _stat('Cost',        '-$_totalGoins G',         _amber),
            _stat(_overBudget ? '⛔ Short' : '✅ Left', '$_goinsAfter G', _overBudget ? _red : _green),
          ]),
        ),
        const SizedBox(height: 12),
      ],
      GestureDetector(
        onTap: _openMaterialPicker,
        child: Container(
          width: double.infinity, padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(color: _bgDark, borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _pickedMaterials.isNotEmpty ? _blue.withOpacity(0.4) : Colors.white12)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(_pickedMaterials.isNotEmpty ? Icons.edit_rounded : Icons.add_rounded, color: _blue, size: 18),
            const SizedBox(width: 8),
            Text(
              _pickedMaterials.isNotEmpty ? 'Edit Materials (${_pickedMaterials.length} items)' : '+ Pick Materials',
              style: GoogleFonts.poppins(color: _blue, fontWeight: FontWeight.w600, fontSize: 13)),
          ]),
        ),
      ),
      if (_pickedMaterials.isNotEmpty) ...[
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: _green.withOpacity(0.06), borderRadius: BorderRadius.circular(10)),
          child: Row(children: [
            const Text('🚀', style: TextStyle(fontSize: 12)), const SizedBox(width: 8),
            Expanded(child: Text(
              'Upload video → earn back 2× ($_totalGoins × 2 = ${_totalGoins * 2} Goines)!',
              style: GoogleFonts.poppins(color: Colors.white38, fontSize: 10))),
          ]),
        ),
      ],
    ]),
  );

  Widget _stat(String label, String val, Color c) => Column(children: [
    Text(label, style: GoogleFonts.poppins(color: Colors.white38, fontSize: 9)),
    const SizedBox(height: 2),
    Text(val, style: GoogleFonts.poppins(color: c, fontSize: 12, fontWeight: FontWeight.bold)),
  ]);

  Widget _buildBottomBar() => SafeArea(
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(color: _card, border: Border(top: BorderSide(color: Colors.white10))),
      child: Row(children: [
        Expanded(child: _ActionButton(label: 'Save Draft', icon: Icons.drafts_rounded,
          color: _cardLight, textColor: Colors.white70, loading: false,
          onTap: () => _handleSubmit(isDraft: true))),
        const SizedBox(width: 10),
        Expanded(flex: 2, child: _ActionButton(
          label: _overBudget ? 'Not Enough Goines' : 'Submit Project',
          icon:  _overBudget ? Icons.warning_rounded : Icons.rocket_launch_rounded,
          color: _overBudget ? _red.withOpacity(0.3) : _blue,
          textColor: Colors.white, loading: _submitting,
          onTap: _overBudget ? null : () => _handleSubmit(isDraft: false))),
      ]),
    ),
  );
}

class _MaterialChip extends StatelessWidget {
  final PickedMaterial picked; final VoidCallback onRemove;
  const _MaterialChip({required this.picked, required this.onRemove});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: const Color(0xFF1E3A8A).withOpacity(0.4), borderRadius: BorderRadius.circular(20),
      border: Border.all(color: const Color(0xFF3B82F6).withOpacity(0.3))),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Text('${picked.item.name} ×${picked.quantity}',
        style: GoogleFonts.poppins(color: Colors.white70, fontSize: 11)),
      const SizedBox(width: 4),
      Text('${picked.totalGoins}G',
        style: GoogleFonts.poppins(color: const Color(0xFFF59E0B), fontSize: 10, fontWeight: FontWeight.bold)),
      const SizedBox(width: 4),
      GestureDetector(onTap: onRemove,
        child: const Icon(Icons.close_rounded, size: 13, color: Colors.white38)),
    ]),
  );
}

class _ActionButton extends StatelessWidget {
  final String label; final IconData icon; final Color color;
  final Color textColor; final bool loading; final VoidCallback? onTap;
  const _ActionButton({required this.label, required this.icon, required this.color,
    required this.textColor, required this.loading, required this.onTap});
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: loading ? null : onTap,
    child: Container(
      height: 48,
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(12)),
      child: loading
          ? const Center(child: SizedBox(width: 20, height: 20,
              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)))
          : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(icon, color: textColor, size: 16), const SizedBox(width: 6),
              Text(label, style: GoogleFonts.poppins(color: textColor, fontWeight: FontWeight.w600, fontSize: 13)),
            ]),
    ),
  );
}

class _UploadingDialog extends StatelessWidget {
  const _UploadingDialog();
  @override
  Widget build(BuildContext context) => Dialog(
    backgroundColor: const Color(0xFF1E293B),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    child: Padding(padding: const EdgeInsets.all(28),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const CircularProgressIndicator(color: Color(0xFF3B82F6)),
        const SizedBox(height: 16),
        Text('Uploading project...', style: GoogleFonts.poppins(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500)),
        const SizedBox(height: 4),
        Text('This may take a moment 🚀', style: GoogleFonts.poppins(color: Colors.white38, fontSize: 12)),
      ]),
    ),
  );
}