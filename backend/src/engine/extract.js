// Turns any supported input into text (preferred) or a binary part the model can read directly.
// pdf-parse's package entry point runs a self-test on import, so load the library file directly.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import { config } from '../config.js';

export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
    this.expose = true;
  }
}

const IMAGE_TYPES = {
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/webp': 'image/webp',
  'image/heic': 'image/heic',
  'image/heif': 'image/heif',
};

/** Identify a file from its bytes first (can't be spoofed by a filename), then its declared type. */
export function sniffType(buffer, declaredMime = '', fileName = '') {
  const head = buffer.subarray(0, 12);
  const ascii = head.toString('latin1');
  if (ascii.startsWith('%PDF')) return 'pdf';
  if (head[0] === 0x89 && ascii.slice(1, 4) === 'PNG') return 'image/png';
  if (head[0] === 0xff && head[1] === 0xd8) return 'image/jpeg';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'image/webp';
  if (ascii.slice(4, 8) === 'ftyp' && /heic|heix|mif1|heif/.test(buffer.subarray(8, 12).toString('latin1'))) {
    return 'image/heic';
  }
  const lowerName = fileName.toLowerCase();
  if (ascii.startsWith('PK')) {
    if (lowerName.endsWith('.docx') || declaredMime.includes('wordprocessingml')) return 'docx';
    return 'unsupported';
  }
  if (lowerName.endsWith('.doc') || declaredMime === 'application/msword') return 'unsupported';
  if (lowerName.endsWith('.html') || lowerName.endsWith('.htm') || declaredMime === 'text/html') return 'html';
  // Treat anything else that decodes as mostly-printable UTF-8 as text.
  const sample = buffer.subarray(0, 4096).toString('utf8');
  const printable = sample.replace(/[^\x09\x0a\x0d\x20-\x7e -￿]/g, '');
  if (sample.length && printable.length / sample.length > 0.95) return 'text';
  return 'unsupported';
}

export function htmlToText(html) {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

function cleanText(text) {
  return text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function finish(text, source) {
  const cleaned = cleanText(text);
  const truncated = cleaned.length > config.ai.maxChars;
  return {
    text: truncated ? cleaned.slice(0, config.ai.maxChars) : cleaned,
    binary: null,
    source,
    truncated,
  };
}

/**
 * @returns {Promise<{text: string, binary: {mimeType: string, data: string} | null, source: string, truncated: boolean}>}
 */
export async function extractFromFile(buffer, declaredMime = '', fileName = '') {
  if (!buffer?.length) throw new InputError('The file is empty.');
  if (buffer.length > config.uploads.maxBytes) {
    throw new InputError(`That file is too large. The limit is ${Math.round(config.uploads.maxBytes / 1048576)} MB.`, 413);
  }

  const kind = sniffType(buffer, declaredMime, fileName);

  if (kind === 'pdf') {
    let text = '';
    try {
      text = (await pdfParse(buffer)).text || '';
    } catch {
      // Damaged or encrypted PDFs: let the model try to read the file itself.
    }
    // Scanned PDFs have little or no text layer; send the PDF so the model can read the pages.
    if (text.replace(/\s/g, '').length < 200) {
      return { text: '', binary: { mimeType: 'application/pdf', data: buffer.toString('base64') }, source: 'pdf-scan', truncated: false };
    }
    return finish(text, 'pdf');
  }

  if (kind === 'docx') {
    const { value } = await mammoth.extractRawText({ buffer });
    if (!value.trim()) throw new InputError('That Word document has no readable text.');
    return finish(value, 'docx');
  }

  if (kind.startsWith('image/')) {
    return { text: '', binary: { mimeType: IMAGE_TYPES[kind] || kind, data: buffer.toString('base64') }, source: 'image', truncated: false };
  }

  if (kind === 'html') return finish(htmlToText(buffer.toString('utf8')), 'html');
  if (kind === 'text') return finish(buffer.toString('utf8'), 'text');

  throw new InputError('We can read PDF, Word (.docx), text, web pages and photos (JPG, PNG, WEBP, HEIC). Old .doc files are not supported — save as .docx or PDF first.', 415);
}

export function extractFromText(raw, source = 'paste') {
  const text = typeof raw === 'string' ? raw : '';
  if (text.replace(/\s/g, '').length < 80) {
    throw new InputError('Please paste the full terms or contract — that text is too short to check.');
  }
  return finish(source === 'html' ? htmlToText(text) : text, source);
}
