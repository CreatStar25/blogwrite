import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ArticleData } from '../App';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function saveAsZip(data: ArticleData) {
  const zip = new JSZip();
  
  // Create a folder
  const base = (data.slug || data.title)
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase() || 'article';
  const folderName = base;
  const folder = zip.folder(folderName);
  
  if (!folder) return;

  // Add Markdown file
  let markdownContent = data.content;
  
  // Add Images
  const imgPromises = data.images.map(async (img) => {
    try {
      if (img.blob) {
        folder.file(img.filename, img.blob);
      } else if (img.b64) {
        const binary = atob(img.b64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        folder.file(img.filename, array, { binary: true });
      } else if (img.url) {
        const response = await fetch(img.url);
        const blob = await response.blob();
        folder.file(img.filename, blob);
      }
    } catch (e) {
      console.error(`Failed to download image ${img.filename}`, e);
    }
  });

  await Promise.all(imgPromises);
  
  folder.file(`${folderName}.md`, markdownContent);
  
  const content = await zip.generateAsync({ type: "blob" });
  saveAs(content, `${folderName}.zip`);
}
