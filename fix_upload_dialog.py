import re

path = "app/miniguru/lib/screens/mentor/mentorActivityTab.dart"

with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

start_marker = "  void _showUploadDialog() {\n"
end_marker = "  void _proceedToUpload(List<String> childIds) {\n"

start_count = lines.count(start_marker)
end_count = lines.count(end_marker)

assert start_count == 1, f"Expected exactly 1 start marker, found {start_count}"
assert end_count == 1, f"Expected exactly 1 end marker, found {end_count}"

start_idx = lines.index(start_marker)
end_idx = lines.index(end_marker)

assert start_idx < end_idx, "Start marker must come before end marker"

new_method = '''  void _showUploadDialog() {
    final Set<String> selected = {};
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) => Container(
          height: MediaQuery.of(ctx).size.height * 0.85,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: EdgeInsets.only(
            left: 24, right: 24, top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Text('Upload Video for...',
                  style: GoogleFonts.nunito(
                      fontSize: 20, fontWeight: FontWeight.w900)),
              const SizedBox(height: 6),
              Text('Select which learner(s) this video belongs to',
                  style: GoogleFonts.nunito(
                      fontSize: 13, color: Colors.grey[500])),
              const SizedBox(height: 16),
              Expanded(
                child: _children.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Text('No children added yet.',
                            style: GoogleFonts.nunito(color: Colors.grey[400])),
                      )
                    : ListView.builder(
                        itemCount: _children.length,
                        itemBuilder: (context, index) {
                          final child = _children[index];
                          final isSelected = selected.contains(child.id);
                          return GestureDetector(
                            onTap: () => setSheet(() {
                              if (isSelected) {
                                selected.remove(child.id);
                              } else {
                                selected.add(child.id);
                              }
                            }),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 150),
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? pastelBlueText.withOpacity(0.08)
                                    : Colors.grey[50],
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: isSelected
                                      ? pastelBlueText
                                      : Colors.grey[200]!,
                                  width: isSelected ? 2 : 1,
                                ),
                              ),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 20,
                                    backgroundColor:
                                        pastelBlueText.withOpacity(0.15),
                                    child: Text(child.name[0].toUpperCase(),
                                        style: GoogleFonts.nunito(
                                            fontWeight: FontWeight.w900,
                                            color: pastelBlueText)),
                                  ),
                                  const SizedBox(width: 12),
                                  Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(child.name,
                                          style: GoogleFonts.nunito(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w800)),
                                      if (child.grade != null)
                                        Text('Grade ${child.grade}',
                                            style: GoogleFonts.nunito(
                                                fontSize: 12,
                                                color: Colors.grey[500])),
                                    ],
                                  ),
                                  const Spacer(),
                                  AnimatedContainer(
                                    duration: const Duration(milliseconds: 150),
                                    width: 24,
                                    height: 24,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: isSelected
                                          ? pastelBlueText
                                          : Colors.transparent,
                                      border: Border.all(
                                        color: isSelected
                                            ? pastelBlueText
                                            : Colors.grey[300]!,
                                        width: 2,
                                      ),
                                    ),
                                    child: isSelected
                                        ? const Icon(Icons.check,
                                            color: Colors.white, size: 14)
                                        : null,
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: selected.isEmpty
                      ? null
                      : () {
                          Navigator.pop(ctx);
                          _proceedToUpload(selected.toList());
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: pastelBlueText,
                    disabledBackgroundColor: Colors.grey[300],
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text(
                    selected.isEmpty
                        ? 'Select at least one learner'
                        : 'Continue with ${selected.length} learner${selected.length > 1 ? 's' : ''}',
                    style: GoogleFonts.nunito(
                        fontSize: 15, fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

'''

new_lines = lines[:start_idx] + [new_method] + lines[end_idx:]

with open(path, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("✅ Patch applied successfully.")
print(f"   Old method: lines {start_idx+1} to {end_idx}")
print(f"   File now has {len(new_lines)} lines total.")