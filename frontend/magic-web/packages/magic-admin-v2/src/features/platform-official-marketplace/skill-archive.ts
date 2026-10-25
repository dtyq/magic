import JSZip from "jszip";

const defaultArchiveName = "skill-package";

export const skillArchiveError = {
  emptyFolder: "empty-folder",
} as const;

export class SkillArchiveError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "SkillArchiveError";
    this.code = code;
  }
}

type FolderFile = File & { webkitRelativePath?: string };

function pathSegments(path: string) {
  return path.split(/[\\/]/).filter((segment) => segment && segment !== "." && segment !== "..");
}

export async function createSkillArchiveFromFolderFiles(
  files: Iterable<FolderFile> | ArrayLike<FolderFile>,
): Promise<File> {
  const selected = Array.from(files);
  if (selected.length === 0) {
    throw new SkillArchiveError(skillArchiveError.emptyFolder);
  }

  const firstPath = selected[0].webkitRelativePath?.trim() || selected[0].name;
  const rootFolder = pathSegments(firstPath)[0] || defaultArchiveName;
  const zip = new JSZip();

  for (const file of selected) {
    const segments = pathSegments(file.webkitRelativePath?.trim() || file.name);
    const rootSegments = pathSegments(rootFolder);
    const hasRootPrefix =
      segments.length > rootSegments.length &&
      rootSegments.every((segment, index) => segments[index] === segment);
    const entry = (hasRootPrefix ? segments.slice(rootSegments.length) : segments).join("/") || file.name;
    zip.file(entry, await file.arrayBuffer());
  }

  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], `${rootFolder.replace(/\.zip$/i, "")}.zip`, {
    type: "application/zip",
    lastModified: Date.now(),
  });
}
