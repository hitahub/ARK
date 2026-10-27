import { describe, expect, it } from 'vitest';
import { files } from '../../src/templates/index.js';

describe('generated templates', () => {
  it('uses valid-looking YAML frontmatter in all Templater templates', () => {
    const templatePaths = [
      '999_Templates/TPL_Concept.md',
      '999_Templates/TPL_Project_Task.md',
      '999_Templates/TPL_Daily_Journal.md',
      '999_Templates/TPL_Tech_Architecture.md',
      '999_Templates/TPL_Meeting_Note.md',
      '999_Templates/TPL_Weekly_Review.md',
    ];

    for (const templatePath of templatePaths) {
      const content = files[templatePath];
      const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
      expect(frontmatter, templatePath).not.toBeNull();
      expect(
        frontmatter?.[1]
          .split(/\r?\n/)
          .filter(Boolean)
          .every((line) => /^[A-Za-z_][\w-]*:\s*.*$/.test(line)),
        templatePath,
      ).toBe(true);
    }
  });

  it('provides all expected scaffold file contents', () => {
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        '000_Atlas/Dashboard.md',
        '000_Atlas/MoC_Idea_Matrix.md',
        '999_Templates/TPL_Concept.md',
        '999_Templates/TPL_Project_Task.md',
        '999_Templates/TPL_Daily_Journal.md',
        '999_Templates/TPL_Tech_Architecture.md',
        '999_Templates/TPL_Meeting_Note.md',
        '999_Templates/TPL_Weekly_Review.md',
        '.claudeignore',
      ]),
    );
    expect(Object.values(files).every((content) => typeof content === 'string')).toBe(true);
  });

  it('uses the documented project and task metadata contract', () => {
    const dashboard = files['000_Atlas/Dashboard.md'];
    const task = files['999_Templates/TPL_Project_Task.md'];
    const project = files['200_Projects/210_Project_Alpha/MoC_Project_Alpha.md'];

    expect(task).toContain('type: task');
    expect(task).toContain('status: todo');
    expect(dashboard).toContain('status != "done"');
    expect(project).toContain('type: project');
    expect(project).toContain('status: active');
  });

  it('documents that ignore rules are not access controls', () => {
    expect(files['.claudeignore']).toContain('not an access-control boundary');
  });
});
