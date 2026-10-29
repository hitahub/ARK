import {
  App,
  DropdownComponent,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  Setting,
  TAbstractFile,
  TFolder,
  TextComponent,
} from 'obsidian';
import {
  createNoteContent,
  getAvailableNotePath,
  getNoteFolder,
  sanitizeNoteTitle,
  type ArcNoteType,
} from './noteTemplates.js';
import { findUnresolvedWikilinks } from './wikilinks.js';

const SLIPBOX_PATH = '300_Slipbox';

export default class ArcObsidianPlugin extends Plugin {
  private slipboxStatusBar?: HTMLElement;
  private linkStatusBar?: HTMLElement;
  private linkRefreshTimeout?: number;

  async onload(): Promise<void> {
    this.slipboxStatusBar = this.addStatusBarItem();
    this.linkStatusBar = this.addStatusBarItem();
    this.slipboxStatusBar.addClass('mod-clickable');
    this.linkStatusBar.addClass('mod-clickable');
    this.slipboxStatusBar.setAttribute('aria-label', 'Check ARC Slipbox structure');
    this.linkStatusBar.setAttribute('aria-label', 'Show unresolved ARC wikilinks');
    this.slipboxStatusBar.addEventListener('click', () => this.showSlipboxReport());
    this.linkStatusBar.addEventListener('click', () => this.showLinkReport());

    this.addCommand({
      id: 'check-slipbox',
      name: 'Check ARC Slipbox structure',
      callback: () => this.showSlipboxReport(),
    });
    this.addCommand({
      id: 'create-note',
      name: 'Create ARC note',
      callback: () =>
        new CreateArcNoteModal(this.app, (type, title) => this.createNote(type, title)).open(),
    });
    this.addCommand({
      id: 'check-wikilinks',
      name: 'Check unresolved wikilinks in active note',
      callback: () => this.showLinkReport(),
    });

    this.registerEvent(this.app.vault.on('create', (file) => this.onVaultChange(file)));
    this.registerEvent(this.app.vault.on('delete', (file) => this.onVaultChange(file)));
    this.registerEvent(this.app.vault.on('rename', (file) => this.onVaultChange(file)));
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => this.scheduleLinkStatusRefresh()),
    );
    this.registerEvent(
      this.app.workspace.on('editor-change', () => this.scheduleLinkStatusRefresh()),
    );
    this.registerEvent(
      this.app.metadataCache.on('changed', () => this.scheduleLinkStatusRefresh()),
    );

    this.app.workspace.onLayoutReady(() => {
      this.refreshSlipboxStatus();
      this.refreshLinkStatus();
    });
  }

  onunload(): void {
    if (this.linkRefreshTimeout !== undefined) window.clearTimeout(this.linkRefreshTimeout);
    this.slipboxStatusBar?.remove();
    this.linkStatusBar?.remove();
  }

  private onVaultChange(_file: TAbstractFile): void {
    this.refreshSlipboxStatus();
    this.scheduleLinkStatusRefresh();
  }

  private getSlipboxFolders(): string[] {
    const slipbox = this.app.vault.getAbstractFileByPath(SLIPBOX_PATH);
    if (!(slipbox instanceof TFolder)) return [];

    return slipbox.children
      .filter((child) => child instanceof TFolder)
      .map((folder) => folder.path)
      .sort((left, right) => left.localeCompare(right));
  }

  private getSlipboxPathIssue(): string | undefined {
    const slipbox = this.app.vault.getAbstractFileByPath(SLIPBOX_PATH);
    if (!slipbox) return `The ${SLIPBOX_PATH}/ folder is missing from this vault.`;
    if (!(slipbox instanceof TFolder)) return `${SLIPBOX_PATH} exists but is not a folder.`;
    return undefined;
  }

  private refreshSlipboxStatus(): void {
    const folders = this.getSlipboxFolders();
    const issue = this.getSlipboxPathIssue();
    const status = issue
      ? 'ARC Slipbox: unavailable'
      : folders.length === 0
        ? 'ARC Slipbox: OK'
        : `ARC Slipbox: ${folders.length} folder(s)`;
    this.slipboxStatusBar?.setText(status);
    this.slipboxStatusBar?.setAttribute(
      'aria-label',
      issue
        ? issue
        : folders.length === 0
          ? 'ARC Slipbox is flat'
          : `ARC Slipbox contains ${folders.length} direct subfolder(s); click to inspect`,
    );
    this.slipboxStatusBar?.toggleClass('arc-warning', Boolean(issue) || folders.length > 0);
  }

  private showSlipboxReport(): void {
    const issue = this.getSlipboxPathIssue();
    const folders = this.getSlipboxFolders();
    if (!issue && folders.length === 0) {
      new Notice(`ARC Slipbox is flat (${SLIPBOX_PATH}/).`);
      return;
    }

    new ReportModal(this.app, issue ? 'ARC Slipbox unavailable' : 'ARC Slipbox subfolders', [
      issue ?? `ARC expects notes directly inside ${SLIPBOX_PATH}/.`,
      issue ? '' : 'This is a warning only. The plugin will not move or delete files.',
      '',
      ...folders.map((path) => `- ${path}`),
    ]).open();
  }

  private getUnresolvedLinks(): ReturnType<typeof findUnresolvedWikilinks> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file) return [];

    return findUnresolvedWikilinks(view.editor.getValue(), (target) =>
      Boolean(this.app.metadataCache.getFirstLinkpathDest(target, view.file!.path)),
    );
  }

  private refreshLinkStatus(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file) {
      this.linkStatusBar?.setText('ARC links: N/A');
      this.linkStatusBar?.setAttribute('aria-label', 'Open a Markdown note to check wikilinks');
      this.linkStatusBar?.toggleClass('arc-warning', false);
      return;
    }

    const unresolved = this.getUnresolvedLinks();
    const text =
      unresolved.length === 0 ? 'ARC links: OK' : `ARC links: ${unresolved.length} unresolved`;
    this.linkStatusBar?.setText(text);
    this.linkStatusBar?.setAttribute(
      'aria-label',
      unresolved.length === 0
        ? 'No unresolved wikilinks in the active note'
        : `${unresolved.length} unresolved wikilink(s); click to inspect`,
    );
    this.linkStatusBar?.toggleClass('arc-warning', unresolved.length > 0);
  }

  private scheduleLinkStatusRefresh(): void {
    if (this.linkRefreshTimeout !== undefined) window.clearTimeout(this.linkRefreshTimeout);
    this.linkRefreshTimeout = window.setTimeout(() => {
      this.linkRefreshTimeout = undefined;
      this.refreshLinkStatus();
    }, 150);
  }

  private showLinkReport(): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file) {
      new Notice('Open a Markdown note to check its wikilinks.');
      return;
    }

    const unresolved = this.getUnresolvedLinks();
    if (unresolved.length === 0) {
      new Notice('No unresolved wikilinks in the active note.');
      return;
    }

    const lines = unresolved.map(({ target, start }) => {
      const line = view.editor.offsetToPos(start).line + 1;
      return `- ${target} (line ${line})`;
    });
    new ReportModal(this.app, `Unresolved wikilinks in ${view.file.basename}`, lines).open();
  }

  private async createNote(type: ArcNoteType, rawTitle: string): Promise<boolean> {
    const title = sanitizeNoteTitle(rawTitle);
    if (!title || title === '.' || title === '..') {
      new Notice('Enter a valid note title.');
      return false;
    }

    const folder = getNoteFolder(type);
    try {
      const folderFile = this.app.vault.getAbstractFileByPath(folder);
      if (folderFile && !(folderFile instanceof TFolder)) {
        new Notice(`Cannot create ARC note: ${folder} exists but is not a folder.`);
        return false;
      }
      if (!folderFile) await this.app.vault.createFolder(folder);

      const path = getAvailableNotePath(folder, title, (candidate) =>
        Boolean(this.app.vault.getAbstractFileByPath(candidate)),
      );
      await this.app.vault.create(path, createNoteContent(title, type));
      new Notice(`Created ${type} note: ${path}`);
      return true;
    } catch (error) {
      console.error('Failed to create ARC note', error);
      new Notice(
        `Failed to create ARC note: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}

class CreateArcNoteModal extends Modal {
  private noteType: ArcNoteType = 'concept';
  private title = '';

  constructor(
    app: App,
    private readonly onCreate: (type: ArcNoteType, title: string) => Promise<boolean>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle('Create ARC note');
    new Setting(this.contentEl).setName('Type').addDropdown((dropdown: DropdownComponent) => {
      dropdown
        .addOption('concept', 'Slipbox concept')
        .addOption('project', 'Project')
        .addOption('task', 'Task')
        .setValue(this.noteType)
        .onChange((value) => {
          if (value === 'concept' || value === 'project' || value === 'task') {
            this.noteType = value;
          }
        });
    });

    new Setting(this.contentEl).setName('Title').addText((text: TextComponent) => {
      text.setPlaceholder('Note title').onChange((value) => {
        this.title = value;
      });
      text.inputEl.focus();
      text.inputEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') void this.submit();
      });
    });

    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText('Create')
        .setCta()
        .onClick(() => void this.submit()),
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async submit(): Promise<void> {
    if (await this.onCreate(this.noteType, this.title)) this.close();
  }
}

class ReportModal extends Modal {
  constructor(
    app: App,
    private readonly title: string,
    private readonly lines: string[],
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(this.title);
    const content = this.contentEl.createEl('pre');
    content.setText(this.lines.join('\n'));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
