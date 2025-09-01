import { App, Notice, TFolder, TFile, normalizePath } from 'obsidian';
import * as path from 'path';
// import { nanoid } from 'nanoid';


interface CreateNoteSettings {
    renameFolderPath: string;
    renameIncludeSubfolders: boolean;
    renameMaxCount: string;
    renameIgnoreFolderList: string[];
}

interface Frontmatter {
    created?: string;
    [key: string]: any;
}
export class UpdateNoteManager {
    #app: App;
    #settings: CreateNoteSettings;
    #vaultBasePath: string;
    #noteContent: string;
    #noteUUID: string;
    #attachementList: string[] = [];

    constructor(app: App, settings: CreateNoteSettings) {

        this.#app = app;
        this.#settings = settings;

        // Check if required folders exisit
        if (!this.ensureAllFoldersExist(this.#settings)) {
            throw ("Settings not correct")
        }

        // define base path for vault
        this.#vaultBasePath = (this.#app.vault.adapter as any).basePath;

        // initilize the basic attributes
        this.#noteContent = "";
        this.#noteUUID = "";
    }
 
  
    //
    // -----------------------------------
    //
    public async renameNoteWithCreatedDate(file: TFile, silent: boolean) {
        try {
            // Read file content
            const content = await this.#app.vault.read(file);

            // Extract frontmatter
            const frontmatterMatch = content.match(/^---[\s\S]*?---/);
            if (!frontmatterMatch) {
                if (!silent) {
                    new Notice('No frontmatter found in the note');
                }
                console.log("No frontmatter found in the note " + file.name)
                return;
            }

            const frontmatterStr = frontmatterMatch[0];
            const frontmatter: Frontmatter = this.parseFrontmatter(frontmatterStr);

            if (!frontmatter.created) {
                if (!silent) {
                    new Notice('No <created> date found in frontmatter');
                }
                console.log('No "created" date found in frontmatter' + file.name)
                return;

            }

            // Get date prefix based on 'created' entry in frontmatter
            const datePrefix = this.formatDateForFilename(frontmatter.created);

            // Generate new filename
            const currentName = file.basename;
            const newName = `${datePrefix} ${currentName}`;
            const pathPrefix = file.parent ? `${file.parent.path}/` : '';
            const renamedFile = `${pathPrefix}${newName}.${file.extension}`;

            // Rename the file
            await this.#app.fileManager.renameFile(file, renamedFile);
            await new Promise(resolve => setTimeout(resolve, 50));
            // console.log(`From ${currentName} to ${newName}`)

            if (!silent) {
                new Notice(`Note renamed to: ${newName}`);
            }

        } catch (error) {
            new Notice(`Error renaming note: ${error}`);
            console.error(error);
        }
    }

    private parseFrontmatter(frontmatterStr: string): Frontmatter {
        const result: Frontmatter = {};
        const lines = frontmatterStr.split('\n').slice(1, -1); // Remove --- lines

        for (const line of lines) {
            const match = line.match(/^(\w+):\s*(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                result[key] = value;
            }
        }

        return result;
    }

    private createFileListForRenaming(): TFile[] {
        const listOfFiles: TFile[] = [];

        // console.log("Setting 3: " + JSON.stringify(this.#settings))

        // Process entire vault
        if (this.#settings.renameFolderPath === '') {
            listOfFiles.push(...this.#app.vault.getMarkdownFiles());
        }
        // Process specific folder
        else {
            // console.log("Folder to process: " + this.#settings.renameFolderPath);
            const folder = this.#app.vault.getAbstractFileByPath(this.#settings.renameFolderPath);

            if (!folder || !(folder instanceof TFolder)) {
                new Notice(`Folder not found: ${this.#settings.renameFolderPath}`);
                throw new Error(`Unable to read folder ${this.#settings.renameFolderPath}`);
            }

            // Function to collect files from a folder
            const collectFiles = (folder: TFolder) => {
                folder.children.forEach(child => {
                    // Process files
                    if (child instanceof TFile && child.extension === 'md') {
                        listOfFiles.push(child);
                    }
                    // Process subfolders if requested
                    else if (this.#settings.renameIncludeSubfolders && child instanceof TFolder) {
                        collectFiles(child);
                    }
                });
            };

            collectFiles(folder);
        }

        return listOfFiles;
    }

    //
    // --------------------------
    //
    public async renameAllNotes() {

        const createdTag = '%created%';

        // console.log("Setting 2: " + JSON.stringify(this.#settings))

        // get all relevant markdown files 
        const allFiles = this.createFileListForRenaming();

        let processedCount = 0;
        let skippedCount = 0;

        // Show progress
        const totalFiles = allFiles.length;
        new Notice(`Processing ${totalFiles} files...`);

        // Process files one by one
        for (const file of allFiles) {

            // Check if the file path contains any of the ignored folder names
            const shouldIgnore = this.#settings.renameIgnoreFolderList.some(folderName => file.path.includes(folderName));
            if (shouldIgnore) {
                console.log(`Ignoring file: ${file.path}`);
                continue;
            }

            // Skip files that already have a date prefix (YYYY-MM-DD or YYYYMMDD)
            if (file.basename.match(/^(\d{4}-\d{2}-\d{2}|\d{8})\s/)) {
                skippedCount++;
                continue;
            }

            // process all selected files
            await this.renameNoteWithCreatedDate(file, true);
            processedCount++;

            // if we have a counter which is reached, stop the loop
            if ((Number(this.#settings.renameMaxCount) > 0) && (processedCount == Number(this.#settings.renameMaxCount))) break;

        }

        new Notice(`Processing of ${processedCount} files done`);
    }

      //
    // helper functions 
    //

    // helper fuction to create prefix string
    private createDatePrefix(): string {
        // Create a new Date object
        const currentDate = new Date();

        // Get the year, month, and day components
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Months are zero-based
        const day = String(currentDate.getDate()).padStart(2, '0');

        // Format the date as "YYYY-MM-DD"
        const formattedDate = `${year}-${month}-${day}`;

        return formattedDate;
    }

  
    private sanitizeFileName(name: string): string {

        // first split name 
        const extension = path.extname(name)
        const baseName = path.basename(name, path.extname(name));

        // Replace German Umlauts and sharp S with ASCII equivalents
        const umlautMap: Record<string, string> = {
            ä: "ae",
            ö: "oe",
            ü: "ue",
            Ä: "Ae",
            Ö: "Oe",
            Ü: "Ue",
            ß: "ss",
        };

        // Replace Umlauts first
        let sanitized = baseName.replace(/[äöüÄÖÜß]/g, (match) => umlautMap[match] || match);

        // Remove ALL spaces
        sanitized = sanitized.replace(/ /g, "");

        // Replace other invalid characters with underscores
        sanitized = sanitized
            .replace(/[/\\:*?"<>|]/g, "_")  // Replace invalid characters
            .replace(/^\./, "_")            // Avoid hidden files (e.g., ".file.md" -> "_file.md")
            .replace(/ /, "");               // remove space

        sanitized = sanitized.slice(0, 25)  // finally reduce name to max 25 char

        sanitized = sanitized + extension // and add the extension again

        return sanitized;
    }

    private getFormattedISODate(): string {
        const date = new Date();

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Add 1 because months are 0-indexed
        const day = String(date.getDate()).padStart(2, '0');

        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        const isoDate = `${year}-${month}-${day} ${hours}:${minutes}`;

        return isoDate;
    }

    private async ensureAllFoldersExist(mySettings: CreateNoteSettings): Promise<boolean> {

        // Array of [folderPath, errorMessage]
        const checks: [string, string][] = [
            [this.#settings.renameFolderPath, `Folder ${this.#settings.renameFolderPath} does not exist`]
        ];

        for (const [path, msg] of checks) {
            if (!await this.#app.vault.adapter.exists(path)) {
                new Notice(msg);
                return false;
            }
        }

        return true;
    }

    private formatDateForFilename(dateStr: string): string {

        // Remove all whitespace
        const cleanDate = dateStr.trim();

        // Handle YYYY-MM-DD format (e.g., "2023-08-20")
        if (cleanDate.match(/^\d{4}-\d{2}-\d{2}/)) {
            // return cleanDate.replace(/-/g, '').slice(0, 8);
            return cleanDate.slice(0, 10);
        }
        // Handle DD.MM.YYYY format (e.g., "20.08.2023")
        else if (cleanDate.match(/^\d{2}\.\d{2}\.\d{4}$/)) {

            const parts = cleanDate.split('.');
            // Rearrange from DD.MM.YYYY to YYYY-MM-DD
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }

        return "";
    }

}