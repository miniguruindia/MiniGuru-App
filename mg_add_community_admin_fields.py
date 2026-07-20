#!/usr/bin/env python3
"""
mg_add_community_admin_fields.py

Adds the admin-panel input fields that were missing for data the Flutter
Community screen actually needs:
  - Happenings: City, Emoji
  - Challenges: Category Emoji, Participants, Color (hex)

(Resources needs no new fields — emoji/color are auto-derived from Type on
the Flutter side per mg_fix_community_cms_parsing.py.)

Run from repo root:
    cd /workspaces/MiniGuru-App
    python3 mg_add_community_admin_fields.py
"""
import sys

PATH = "admin/app/content/page.tsx"

with open(PATH, "r") as f:
    content = f.read()

# ── 1. Happenings: add City + Emoji fields ──────────────────────────────────
OLD_HAPPENING = '''            <div className="grid grid-cols-2 gap-3">
              <Field label="Title"><input className={inp} value={h.title || ''} onChange={e => updateItem('happenings', h.id, 'title', e.target.value)} /></Field>
              <Field label="Date (YYYY-MM-DD)"><input className={inp} value={h.date || ''} onChange={e => updateItem('happenings', h.id, 'date', e.target.value)} /></Field>
            </div>
            <Field label="Description"><textarea className={ta} rows={2} value={h.description || ''} onChange={e => updateItem('happenings', h.id, 'description', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tag (NEW / UPCOMING / PAST)"><input className={inp} value={h.tag || ''} onChange={e => updateItem('happenings', h.id, 'tag', e.target.value)} /></Field>
              <Field label="Image URL (optional)"><input className={inp} value={h.imageUrl || ''} onChange={e => updateItem('happenings', h.id, 'imageUrl', e.target.value)} /></Field>
            </div>
          </div>
        ))}
        <button onClick={() => addItem('happenings', { title: '', date: '', description: '', tag: 'NEW', imageUrl: '' })}'''

NEW_HAPPENING = '''            <div className="grid grid-cols-2 gap-3">
              <Field label="Title"><input className={inp} value={h.title || ''} onChange={e => updateItem('happenings', h.id, 'title', e.target.value)} /></Field>
              <Field label="Date (YYYY-MM-DD)"><input className={inp} value={h.date || ''} onChange={e => updateItem('happenings', h.id, 'date', e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City"><input className={inp} value={h.city || ''} onChange={e => updateItem('happenings', h.id, 'city', e.target.value)} /></Field>
              <Field label="Emoji (e.g. 🏫 🏠 🏢)"><input className={inp} value={h.emoji || ''} onChange={e => updateItem('happenings', h.id, 'emoji', e.target.value)} /></Field>
            </div>
            <Field label="Description"><textarea className={ta} rows={2} value={h.description || ''} onChange={e => updateItem('happenings', h.id, 'description', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tag (NEW / UPCOMING / MILESTONE / AWARD / PAST)"><input className={inp} value={h.tag || ''} onChange={e => updateItem('happenings', h.id, 'tag', e.target.value)} /></Field>
              <Field label="Image URL (optional)"><input className={inp} value={h.imageUrl || ''} onChange={e => updateItem('happenings', h.id, 'imageUrl', e.target.value)} /></Field>
            </div>
          </div>
        ))}
        <button onClick={() => addItem('happenings', { title: '', date: '', description: '', tag: 'NEW', imageUrl: '', city: '', emoji: '🏫' })}'''

count = content.count(OLD_HAPPENING)
if count != 1:
    print(f"❌ ABORTING on happenings block — expected exactly 1 match, found {count}")
    sys.exit(1)
content = content.replace(OLD_HAPPENING, NEW_HAPPENING)

# ── 2. Challenges: add Category Emoji, Participants, Color fields ──────────
OLD_CHALLENGE = '''              <Field label="Goins Reward"><input type="number" className={inp} value={c.goinsReward || 0} onChange={e => updateItem('challenges', c.id, 'goinsReward', e.target.value)} /></Field>
              <Field label="Status">
                <select className={inp} value={c.status || 'upcoming'} onChange={e => updateItem('challenges', c.id, 'status', e.target.value)}>
                  <option value="ongoing">Ongoing</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                </select>
              </Field>
            </div>
            <Field label="End Date"><input className={inp} value={c.endDate || ''} onChange={e => updateItem('challenges', c.id, 'endDate', e.target.value)} /></Field>
            <Field label="Description"><textarea className={ta} rows={2} value={c.description || ''} onChange={e => updateItem('challenges', c.id, 'description', e.target.value)} /></Field>
          </div>
        ))}
        <button onClick={() => addItem('challenges', { title: '', category: '', difficulty: 'Medium', goinsReward: 100, endDate: '', status: 'upcoming', description: '' })}'''

NEW_CHALLENGE = '''              <Field label="Goins Reward"><input type="number" className={inp} value={c.goinsReward || 0} onChange={e => updateItem('challenges', c.id, 'goinsReward', e.target.value)} /></Field>
              <Field label="Status">
                <select className={inp} value={c.status || 'upcoming'} onChange={e => updateItem('challenges', c.id, 'status', e.target.value)}>
                  <option value="ongoing">Ongoing</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Category Emoji (optional)"><input className={inp} value={c.categoryEmoji || ''} onChange={e => updateItem('challenges', c.id, 'categoryEmoji', e.target.value)} placeholder="auto if blank" /></Field>
              <Field label="Participants (optional)"><input type="number" className={inp} value={c.participants || 0} onChange={e => updateItem('challenges', c.id, 'participants', e.target.value)} /></Field>
              <Field label="Color hex (optional)"><input className={inp} value={c.color || ''} onChange={e => updateItem('challenges', c.id, 'color', e.target.value)} placeholder="auto if blank, e.g. 3B82F6" /></Field>
            </div>
            <Field label="End Date"><input className={inp} value={c.endDate || ''} onChange={e => updateItem('challenges', c.id, 'endDate', e.target.value)} /></Field>
            <Field label="Description"><textarea className={ta} rows={2} value={c.description || ''} onChange={e => updateItem('challenges', c.id, 'description', e.target.value)} /></Field>
          </div>
        ))}
        <button onClick={() => addItem('challenges', { title: '', category: '', difficulty: 'Medium', goinsReward: 100, endDate: '', status: 'upcoming', description: '', categoryEmoji: '', participants: 0, color: '' })}'''

count = content.count(OLD_CHALLENGE)
if count != 1:
    print(f"❌ ABORTING on challenges block — expected exactly 1 match, found {count}")
    sys.exit(1)
content = content.replace(OLD_CHALLENGE, NEW_CHALLENGE)

with open(PATH, "w") as f:
    f.write(content)

print(f"✅ Patched {PATH} — added City/Emoji (Happenings) + Category Emoji/Participants/Color (Challenges)")
