export type ArcNoteType = 'concept' | 'project' | 'task';

export function sanitizeNoteTitle(title: string): string {
  return title
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
}

export function getNoteFolder(type: ArcNoteType): string {
  return type === 'concept' ? '300_Slipbox' : '200_Projects';
}

export function getAvailableNotePath(
  folder: string,
  title: string,
  pathExists: (path: string) => boolean,
): string {
  const basePath = `${folder}/${title}`;
  let path = `${basePath}.md`;
  let suffix = 2;
  while (pathExists(path)) {
    path = `${basePath} ${suffix}.md`;
    suffix += 1;
  }
  return path;
}

export function createNoteContent(
  title: string,
  type: ArcNoteType,
  now: Date = new Date(),
): string {
  const date = formatDate(now);
  const id = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');

  if (type === 'concept') {
    return `---
id: ${id}
type: concept
tags: []
created: ${date}
---

# ${title}

## Idea


## Connections

-
`;
  }

  if (type === 'project') {
    return `---
type: project
status: active
deadline:
---

# ${title}

## Desired outcome


## Active phase


## Tasks
`;
  }

  return `---
type: task
project: ""
phase: ""
status: todo
created: ${date}
deadline:
---

# ${title}

## Outcome


## Next actions

- [ ]
`;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
