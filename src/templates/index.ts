import { atomic } from './atomic.js';
import { dashboard } from './dashboard.js';
import { ignore } from './ignore.js';
import { journal } from './journal.js';
import { matrix } from './matrix.js';
import { meeting } from './meeting.js';
import { projectIndex } from './project.js';
import { task } from './task.js';
import { techArch } from './techArch.js';
import { weeklyReview } from './weeklyReview.js';

// Keys are vault-relative paths; init uses this map to create each generated Markdown file.
export const files: Record<string, string> = {
  '000_Atlas/Dashboard.md': dashboard,
  '000_Atlas/MoC_Idea_Matrix.md': matrix,
  '200_Projects/210_Project_Alpha/MoC_Project_Alpha.md': projectIndex,
  '300_Slipbox/.gitkeep': '',
  '400_Journal/.gitkeep': '',
  '999_Templates/TPL_Concept.md': atomic,
  '999_Templates/TPL_Project_Task.md': task,
  '999_Templates/TPL_Daily_Journal.md': journal,
  '999_Templates/TPL_Tech_Architecture.md': techArch,
  '999_Templates/TPL_Meeting_Note.md': meeting,
  '999_Templates/TPL_Weekly_Review.md': weeklyReview,
  '.claudeignore': ignore,
};

export const scaffoldFiles: Record<string, string> = {
  ...files,
  '100_Spaces/110_Career_Business/.gitkeep': '',
  '100_Spaces/120_Creative_SideHustle/.gitkeep': '',
  '100_Spaces/130_Personal/.gitkeep': '',
  '200_Projects/.gitkeep': '',
};
