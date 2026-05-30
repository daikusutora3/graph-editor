export function downloadBlob(blob: Blob, fileName: string) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = blobUrl;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
}

export function ensurePngBlob(blob: Blob) {
  return blob.type === "image/png"
    ? blob
    : new Blob([blob], { type: "image/png" });
}

export async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn("Clipboard API copy failed; trying fallback", error);
    }
  }

  return copyTextWithTextarea(text);
}

function copyTextWithTextarea(text: string) {
  const textarea = document.createElement("textarea");
  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const selection = document.getSelection();
  const ranges =
    selection && selection.rangeCount > 0
      ? Array.from({ length: selection.rangeCount }, (_, index) =>
          selection.getRangeAt(index),
        )
      : [];

  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    return document.execCommand("copy");
  } catch (error) {
    console.warn("Textarea fallback copy failed", error);
    return false;
  } finally {
    textarea.remove();
    activeElement?.focus();

    if (selection) {
      selection.removeAllRanges();
      ranges.forEach((range) => selection.addRange(range));
    }
  }
}

export function formatTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}
