#!/usr/bin/env python3
"""Fix _extractString by finding it by line number and replacing until closing }"""
import re

TARGET = '/workspaces/MiniGuru-App/app/miniguru/lib/screens/legalScreen.dart'
with open(TARGET, 'r') as f:
    lines = f.readlines()

# Find start of _extractString method
start = None
for i, line in enumerate(lines):
    if 'String _extractString' in line:
        start = i
        break

if start is None:
    print('ERROR: method not found')
    exit(1)

# Find end — closing } at same indent level
depth = 0
end = None
for i in range(start, len(lines)):
    depth += lines[i].count('{') - lines[i].count('}')
    if depth <= 0 and i > start:
        end = i
        break

print(f'Found _extractString: lines {start+1} to {end+1}')
print('Current content:')
for i in range(start, min(end+1, start+10)):
    print(f'  {i+1}: {lines[i].rstrip()}')

# New correct method using string concatenation (no quotes inside interpolation)
NEW_METHOD = (
    "  String _extractString(Map<String, dynamic>? data, String fallback) {\n"
    "    if (data == null) return fallback;\n"
    "    if (data['content'] is String) return data['content'] as String;\n"
    "    try {\n"
    "      final sections = data['sections'] as List<dynamic>?;\n"
    "      if (sections != null && sections.isNotEmpty) {\n"
    "        final sb = StringBuffer();\n"
    "        final title   = (data['title']       ?? '').toString();\n"
    "        final updated = (data['lastUpdated']  ?? '').toString();\n"
    "        if (title.isNotEmpty)   sb.writeln('# ' + title);\n"
    "        if (updated.isNotEmpty) { sb.writeln('Last updated: ' + updated); sb.writeln(); }\n"
    "        for (final s in sections) {\n"
    "          final m       = Map<String, dynamic>.from(s as Map);\n"
    "          final heading = (m['heading'] ?? '').toString();\n"
    "          final body    = (m['body']    ?? '').toString();\n"
    "          if (heading.isNotEmpty) sb.writeln('## ' + heading);\n"
    "          if (body.isNotEmpty)    sb.writeln(body);\n"
    "          sb.writeln();\n"
    "        }\n"
    "        return sb.toString();\n"
    "      }\n"
    "    } catch (_) {}\n"
    "    return fallback;\n"
    "  }\n"
)

lines = lines[:start] + [NEW_METHOD] + lines[end+1:]

with open(TARGET, 'w') as f:
    f.writelines(lines)

print('✅ _extractString replaced correctly')
