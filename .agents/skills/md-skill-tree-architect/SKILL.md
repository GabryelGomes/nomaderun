---
name: md-skill-tree-architect
description: Create Markdown-first skill trees, progression tracks, node cards, trials, rewards, prerequisites, YAML frontmatter schemas, and git-friendly mastery systems. Use when the user wants MD-based gamification, skill progression, learning paths, or portable skill-tree repos.
---

# Markdown Skill Tree Architect

Use this skill to design portable skill trees that live in git as Markdown.

## Workflow

1. Define the audience and capability promise.
2. Choose axes and ranks.
3. Create track files.
4. Create node files with prerequisites and acceptance criteria.
5. Create trial files for rank-up.
6. Create reward files that unlock useful work.
7. Create a ledger event example.
8. Add validation checks for unreachable nodes and circular prerequisites.

## Frontmatter Minimum

```yaml
---
id: stable-id
type: track | node | trial | reward
status: draft | active | deprecated
visibility: public | unlisted | private
version: 0.1.0
---
```

## Quality Gates

- Every node must teach or unlock one capability.
- Every trial must have objective acceptance criteria.
- Every reward must change what can be done.
- Keep lore names separate from platform names.

## Output Shape

- Folder map.
- Track outline.
- Node cards.
- Trial cards.
- Reward cards.
- Validation checklist.

