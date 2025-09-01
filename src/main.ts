import { App, Notice, Plugin, Menu, MenuItem, PluginSettingTab, Setting, AbstractInputSuggest, TFolder, TFile } from 'obsidian';
import { UpdateNoteManager } from './UpdateNoteManager';

interface UpdateNoteSettings {
    renameFolderPath: string;
    renameIncludeSubfolders: boolean;
    renameMaxCount: string;
    renameIgnoreFolderList: string[];
}

const DEFAULT_SETTINGS: UpdateNoteSettings = {
    renameFolderPath: '',
    renameIncludeSubfolders: false,
    renameMaxCount: '20',
    renameIgnoreFolderList: ['_files']
}

export default class updateNotePlugin extends Plugin {
    settings: UpdateNoteSettings;

    async onload() {
        await this.loadSettings();

        // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
        const statusBarItemEl = this.addStatusBarItem();
        statusBarItemEl.setText('Status Bar Text');

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new CreateNoteSettingTab(this.app, this));

        // Register a command to rename selected notes
        this.addCommand({
            id: 'rename-selected-notes-with-date',
            name: 'Rename selected note with create-date prefix',
            callback: async () => {
                try {
                    const activeFile = this.app.workspace.getActiveFile();
                    if (!activeFile) {
                        new Notice('No active note found');
                        return;
                    }
                    const extNoteMgr = new UpdateNoteManager(this.app, this.settings);
                    await extNoteMgr.renameNoteWithCreatedDate(activeFile, false);
                }
                catch (error) {
                    new Notice('Error changing note name')
                    console.error('Error changing note name:', error);
                }
            }
        });

        // Register a command to notes
        this.addCommand({
            id: 'rename-all-notes-with-date',
            name: 'Rename all notes with create-date prefix',
            callback: async () => {
                try {
                    const extNoteMgr = new UpdateNoteManager(this.app, this.settings);
                    await extNoteMgr.renameAllNotes();
                }
                catch (error) {
                    new Notice('Error changing name of all notes')
                    console.error('Error changing name of all notes:', error);
                }
            }
        });

        // Register for file menu (context menu)
        this.registerEvent(
            this.app.workspace.on("file-menu", (menu: Menu, file: TFile) => {
                // Only show for markdown files
                if (file instanceof TFile && file.extension === 'md') {
                    menu.addItem((item: MenuItem) => {
                        item
                            .setTitle('Rename with created date')
                            .setIcon('dice')
                            .onClick(async () => {
                                const extNoteMgr = new UpdateNoteManager(this.app, this.settings);
                                await extNoteMgr.renameNoteWithCreatedDate(file, true);
                            });
                    });
                }
            })
        );

    }

    onunload() {
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

}

class FolderSuggest extends AbstractInputSuggest<TFolder> {
    constructor(app: App, private inputEl: HTMLInputElement) {
        super(app, inputEl);
    }

    // Called when suggestions need to be calculated
    getSuggestions(inputStr: string): TFolder[] {
        const folders: TFolder[] = [];
        ObsidianVaultTraversal(this.app.vault.getRoot(), folders);
        return folders.filter(folder => folder.path.toLowerCase().includes(inputStr.toLowerCase()));
    }

    // Renders a suggestion item
    renderSuggestion(folder: TFolder, el: HTMLElement) {
        el.setText(folder.path);
    }

    // Sets the value to the input on selection
    selectSuggestion(folder: TFolder) {
        this.inputEl.value = folder.path;
        this.inputEl.trigger("input");
        this.close();
    }
}

// Helper function to recursively gather all folders in the vault
function ObsidianVaultTraversal(folder: TFolder, result: TFolder[]) {
    result.push(folder);
    for (const child of folder.children) {
        if (child instanceof TFolder) {
            ObsidianVaultTraversal(child, result);
        }
    }
}

class CreateNoteSettingTab extends PluginSettingTab {
    plugin: updateNotePlugin;

    folders: { path: string, folder: TFolder }[] = [];


    constructor(app: App, plugin: updateNotePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    collectFolders(folder: TFolder) {
        // Don't include root folder in the list for cleaner UI
        if (folder.path !== '/') {
            this.folders.push({ path: folder.path, folder });
        }

        folder.children.forEach(child => {
            if (child instanceof TFolder) {
                this.collectFolders(child);
            }
        });
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        let inputArray: HTMLInputElement[] = [];

        //
        // settings for rename tool
        //

        new Setting(containerEl)
            .setName('Renaming: Maximal Count')
            .setDesc('Limit the number of files to be renamed')
            .addText(text => {
                text.inputEl.placeholder = "0 for entire vault";
                text.inputEl.type = "number"; // Ensure the input type is number
                text.inputEl.min = "0"; // Set the minimum value to 0
                text.setValue(this.plugin.settings.renameMaxCount);
                // Save selected folder to settings
                text.onChange(async (value) => {
                    this.plugin.settings.renameMaxCount = value;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName('Renaming: Ignore Folders')
            .setDesc('Enter each folder name to ignore during renaming on a new line.')
            .addTextArea(textArea => {
                textArea
                    .setPlaceholder('e.g.,\n_files\ntemp\nbackup')
                    .setValue(this.plugin.settings.renameIgnoreFolderList.join('\n'))
                    .onChange(async (value) => {
                        this.plugin.settings.renameIgnoreFolderList = value.split('\n').map(folder => folder.trim()).filter(folder => folder !== '');
                        await this.plugin.saveSettings();
                    });
            });


        new Setting(containerEl)
            .setName('Renaming: Scope')
            .setDesc('Choose to process the entire vault or a specific folder')
            .addDropdown(dropdown => {
                const initialValue = this.plugin.settings.renameFolderPath ? 'folder' : 'vault';
                dropdown.addOption('vault', 'Entire Vault')
                dropdown.addOption('folder', 'Specific Folder')
                dropdown.setValue(initialValue)
                dropdown.onChange(async value => {
                    if (value === 'vault') {
                        this.plugin.settings.renameFolderPath = '';
                        folderSelectionContainer.style.display = 'none';
                    } else {
                        folderSelectionContainer.style.display = 'block';
                    }
                    await this.plugin.saveSettings();
                });
            });

        // Container for folder selection (initially hidden)
        const folderSelectionContainer = containerEl.createDiv();
        if (this.plugin.settings.renameFolderPath === '') {
            folderSelectionContainer.style.display = 'none';
        } else {
            folderSelectionContainer.style.display = 'block'
        }

        new Setting(folderSelectionContainer)
            .setName("Renaming: Select Folder")
            .setDesc("Choose which folder to process")
            .addText(text => {
                text.inputEl.placeholder = "Start typing to search folders";
                text.setValue(this.plugin.settings.renameFolderPath ?? "");
                new FolderSuggest(this.app, text.inputEl);

                // Save selected folder to settings
                text.onChange(async (value) => {
                    this.plugin.settings.renameFolderPath = value;
                    await this.plugin.saveSettings();
                })
            });

        new Setting(folderSelectionContainer)
            .setName('Renaming: Include Subfolders')
            .setDesc('Process notes in subfolders as well')
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.renameIncludeSubfolders)
                    .onChange(async value => {
                        this.plugin.settings.renameIncludeSubfolders = value;
                        await this.plugin.saveSettings();
                    });
            });

        // set initial state
        const enabled = this.plugin.settings.useTemplate === true;
        inputArray.forEach(input => input.disabled = !enabled);

    }
}

