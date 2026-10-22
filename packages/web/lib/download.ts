/** Makes the browser save these bytes as a file. */
export function saveFile(fileName: string, content: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoked after the click is handled, or some browsers cancel the download.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
