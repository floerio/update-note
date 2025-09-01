var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => updateNotePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/UpdateNoteManager.ts
var import_obsidian = require("obsidian");
var path = __toESM(require("path"));
var _app, _settings, _vaultBasePath, _noteContent, _noteUUID, _attachementList;
var UpdateNoteManager = class {
  constructor(app, settings) {
    __privateAdd(this, _app);
    __privateAdd(this, _settings);
    __privateAdd(this, _vaultBasePath);
    __privateAdd(this, _noteContent);
    __privateAdd(this, _noteUUID);
    __privateAdd(this, _attachementList, []);
    __privateSet(this, _app, app);
    __privateSet(this, _settings, settings);
    if (!this.ensureAllFoldersExist(__privateGet(this, _settings))) {
      throw "Settings not correct";
    }
    __privateSet(this, _vaultBasePath, __privateGet(this, _app).vault.adapter.basePath);
    __privateSet(this, _noteContent, "");
    __privateSet(this, _noteUUID, "");
  }
  //
  // -----------------------------------
  //
  async renameNoteWithCreatedDate(file, silent) {
    try {
      const content = await __privateGet(this, _app).vault.read(file);
      const frontmatterMatch = content.match(/^---[\s\S]*?---/);
      if (!frontmatterMatch) {
        if (!silent) {
          new import_obsidian.Notice("No frontmatter found in the note");
        }
        console.log("No frontmatter found in the note " + file.name);
        return;
      }
      const frontmatterStr = frontmatterMatch[0];
      const frontmatter = this.parseFrontmatter(frontmatterStr);
      if (!frontmatter.created) {
        if (!silent) {
          new import_obsidian.Notice("No <created> date found in frontmatter");
        }
        console.log('No "created" date found in frontmatter' + file.name);
        return;
      }
      const datePrefix = this.formatDateForFilename(frontmatter.created);
      const currentName = file.basename;
      const newName = `${datePrefix} ${currentName}`;
      const pathPrefix = file.parent ? `${file.parent.path}/` : "";
      const renamedFile = `${pathPrefix}${newName}.${file.extension}`;
      await __privateGet(this, _app).fileManager.renameFile(file, renamedFile);
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (!silent) {
        new import_obsidian.Notice(`Note renamed to: ${newName}`);
      }
    } catch (error) {
      new import_obsidian.Notice(`Error renaming note: ${error}`);
      console.error(error);
    }
  }
  parseFrontmatter(frontmatterStr) {
    const result = {};
    const lines = frontmatterStr.split("\n").slice(1, -1);
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
  createFileListForRenaming() {
    const listOfFiles = [];
    if (__privateGet(this, _settings).renameFolderPath === "") {
      listOfFiles.push(...__privateGet(this, _app).vault.getMarkdownFiles());
    } else {
      const folder = __privateGet(this, _app).vault.getAbstractFileByPath(__privateGet(this, _settings).renameFolderPath);
      if (!folder || !(folder instanceof import_obsidian.TFolder)) {
        new import_obsidian.Notice(`Folder not found: ${__privateGet(this, _settings).renameFolderPath}`);
        throw new Error(`Unable to read folder ${__privateGet(this, _settings).renameFolderPath}`);
      }
      const collectFiles = (folder2) => {
        folder2.children.forEach((child) => {
          if (child instanceof import_obsidian.TFile && child.extension === "md") {
            listOfFiles.push(child);
          } else if (__privateGet(this, _settings).renameIncludeSubfolders && child instanceof import_obsidian.TFolder) {
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
  async renameAllNotes() {
    const createdTag = "%created%";
    const allFiles = this.createFileListForRenaming();
    let processedCount = 0;
    let skippedCount = 0;
    const totalFiles = allFiles.length;
    new import_obsidian.Notice(`Processing ${totalFiles} files...`);
    for (const file of allFiles) {
      const shouldIgnore = __privateGet(this, _settings).renameIgnoreFolderList.some((folderName) => file.path.includes(folderName));
      if (shouldIgnore) {
        console.log(`Ignoring file: ${file.path}`);
        continue;
      }
      if (file.basename.match(/^(\d{4}-\d{2}-\d{2}|\d{8})\s/)) {
        skippedCount++;
        continue;
      }
      await this.renameNoteWithCreatedDate(file, true);
      processedCount++;
      if (Number(__privateGet(this, _settings).renameMaxCount) > 0 && processedCount == Number(__privateGet(this, _settings).renameMaxCount)) break;
    }
    new import_obsidian.Notice(`Processing of ${processedCount} files done`);
  }
  //
  // helper functions 
  //
  // helper fuction to create prefix string
  createDatePrefix() {
    const currentDate = /* @__PURE__ */ new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    const day = String(currentDate.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;
    return formattedDate;
  }
  sanitizeFileName(name) {
    const extension = path.extname(name);
    const baseName = path.basename(name, path.extname(name));
    const umlautMap = {
      \u00E4: "ae",
      \u00F6: "oe",
      \u00FC: "ue",
      \u00C4: "Ae",
      \u00D6: "Oe",
      \u00DC: "Ue",
      \u00DF: "ss"
    };
    let sanitized = baseName.replace(/[äöüÄÖÜß]/g, (match) => umlautMap[match] || match);
    sanitized = sanitized.replace(/ /g, "");
    sanitized = sanitized.replace(/[/\\:*?"<>|]/g, "_").replace(/^\./, "_").replace(/ /, "");
    sanitized = sanitized.slice(0, 25);
    sanitized = sanitized + extension;
    return sanitized;
  }
  getFormattedISODate() {
    const date = /* @__PURE__ */ new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const isoDate = `${year}-${month}-${day} ${hours}:${minutes}`;
    return isoDate;
  }
  async ensureAllFoldersExist(mySettings) {
    const checks = [
      [__privateGet(this, _settings).renameFolderPath, `Folder ${__privateGet(this, _settings).renameFolderPath} does not exist`]
    ];
    for (const [path2, msg] of checks) {
      if (!await __privateGet(this, _app).vault.adapter.exists(path2)) {
        new import_obsidian.Notice(msg);
        return false;
      }
    }
    return true;
  }
  formatDateForFilename(dateStr) {
    const cleanDate = dateStr.trim();
    if (cleanDate.match(/^\d{4}-\d{2}-\d{2}/)) {
      return cleanDate.slice(0, 10);
    } else if (cleanDate.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
      const parts = cleanDate.split(".");
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return "";
  }
};
_app = new WeakMap();
_settings = new WeakMap();
_vaultBasePath = new WeakMap();
_noteContent = new WeakMap();
_noteUUID = new WeakMap();
_attachementList = new WeakMap();

// src/main.ts
var DEFAULT_SETTINGS = {
  renameFolderPath: "",
  renameIncludeSubfolders: false,
  renameMaxCount: "20",
  renameIgnoreFolderList: ["_files"]
};
var updateNotePlugin = class extends import_obsidian2.Plugin {
  async onload() {
    await this.loadSettings();
    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.setText("Status Bar Text");
    this.addSettingTab(new CreateNoteSettingTab(this.app, this));
    this.addCommand({
      id: "rename-selected-notes-with-date",
      name: "Rename selected note with create-date prefix",
      callback: async () => {
        try {
          const activeFile = this.app.workspace.getActiveFile();
          if (!activeFile) {
            new import_obsidian2.Notice("No active note found");
            return;
          }
          const extNoteMgr = new UpdateNoteManager(this.app, this.settings);
          await extNoteMgr.renameNoteWithCreatedDate(activeFile, false);
        } catch (error) {
          new import_obsidian2.Notice("Error changing note name");
          console.error("Error changing note name:", error);
        }
      }
    });
    this.addCommand({
      id: "rename-all-notes-with-date",
      name: "Rename all notes with create-date prefix",
      callback: async () => {
        try {
          const extNoteMgr = new UpdateNoteManager(this.app, this.settings);
          await extNoteMgr.renameAllNotes();
        } catch (error) {
          new import_obsidian2.Notice("Error changing name of all notes");
          console.error("Error changing name of all notes:", error);
        }
      }
    });
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof import_obsidian2.TFile && file.extension === "md") {
          menu.addItem((item) => {
            item.setTitle("Rename with created date").setIcon("dice").onClick(async () => {
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
};
var FolderSuggest = class extends import_obsidian2.AbstractInputSuggest {
  constructor(app, inputEl) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }
  // Called when suggestions need to be calculated
  getSuggestions(inputStr) {
    const folders = [];
    ObsidianVaultTraversal(this.app.vault.getRoot(), folders);
    return folders.filter((folder) => folder.path.toLowerCase().includes(inputStr.toLowerCase()));
  }
  // Renders a suggestion item
  renderSuggestion(folder, el) {
    el.setText(folder.path);
  }
  // Sets the value to the input on selection
  selectSuggestion(folder) {
    this.inputEl.value = folder.path;
    this.inputEl.trigger("input");
    this.close();
  }
};
function ObsidianVaultTraversal(folder, result) {
  result.push(folder);
  for (const child of folder.children) {
    if (child instanceof import_obsidian2.TFolder) {
      ObsidianVaultTraversal(child, result);
    }
  }
}
var CreateNoteSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.folders = [];
    this.plugin = plugin;
  }
  collectFolders(folder) {
    if (folder.path !== "/") {
      this.folders.push({ path: folder.path, folder });
    }
    folder.children.forEach((child) => {
      if (child instanceof import_obsidian2.TFolder) {
        this.collectFolders(child);
      }
    });
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    let inputArray = [];
    new import_obsidian2.Setting(containerEl).setName("Renaming: Maximal Count").setDesc("Limit the number of files to be renamed").addText((text) => {
      text.inputEl.placeholder = "0 for entire vault";
      text.inputEl.type = "number";
      text.inputEl.min = "0";
      text.setValue(this.plugin.settings.renameMaxCount);
      text.onChange(async (value) => {
        this.plugin.settings.renameMaxCount = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Renaming: Ignore Folders").setDesc("Enter each folder name to ignore during renaming on a new line.").addTextArea((textArea) => {
      textArea.setPlaceholder("e.g.,\n_files\ntemp\nbackup").setValue(this.plugin.settings.renameIgnoreFolderList.join("\n")).onChange(async (value) => {
        this.plugin.settings.renameIgnoreFolderList = value.split("\n").map((folder) => folder.trim()).filter((folder) => folder !== "");
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Renaming: Scope").setDesc("Choose to process the entire vault or a specific folder").addDropdown((dropdown) => {
      const initialValue = this.plugin.settings.renameFolderPath ? "folder" : "vault";
      dropdown.addOption("vault", "Entire Vault");
      dropdown.addOption("folder", "Specific Folder");
      dropdown.setValue(initialValue);
      dropdown.onChange(async (value) => {
        if (value === "vault") {
          this.plugin.settings.renameFolderPath = "";
          folderSelectionContainer.style.display = "none";
        } else {
          folderSelectionContainer.style.display = "block";
        }
        await this.plugin.saveSettings();
      });
    });
    const folderSelectionContainer = containerEl.createDiv();
    if (this.plugin.settings.renameFolderPath === "") {
      folderSelectionContainer.style.display = "none";
    } else {
      folderSelectionContainer.style.display = "block";
    }
    new import_obsidian2.Setting(folderSelectionContainer).setName("Renaming: Select Folder").setDesc("Choose which folder to process").addText((text) => {
      text.inputEl.placeholder = "Start typing to search folders";
      text.setValue(this.plugin.settings.renameFolderPath ?? "");
      new FolderSuggest(this.app, text.inputEl);
      text.onChange(async (value) => {
        this.plugin.settings.renameFolderPath = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(folderSelectionContainer).setName("Renaming: Include Subfolders").setDesc("Process notes in subfolders as well").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.renameIncludeSubfolders).onChange(async (value) => {
        this.plugin.settings.renameIncludeSubfolders = value;
        await this.plugin.saveSettings();
      });
    });
  }
};
