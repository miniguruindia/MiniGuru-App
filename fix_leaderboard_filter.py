#!/usr/bin/env python3
import os, shutil

TARGET = '/workspaces/MiniGuru-App/backend/src/routes/leaderboardRoutes.ts'
with open(TARGET, 'r') as f:
    content = f.read()

shutil.copy(TARGET, TARGET + '.bak')

OLD = """    const topUsers = await prisma.user.findMany({
      where: {
        score: { gt: 0 },
      },"""

NEW = """    const topUsers = await prisma.user.findMany({
      where: {
        score: { gt: 0 },
        role: 'USER', // exclude admins from leaderboard
      },"""

if OLD in content:
    content = content.replace(OLD, NEW)
    with open(TARGET, 'w') as f:
        f.write(content)
    print('✅ Admin filtered from leaderboard')
else:
    print('Already filtered or pattern changed')
