/**
 * Read a table from ERP exports and office files:
 * CSV / TSV / Excel / JSON / HTML, plus PDF, Word, PowerPoint, images (OCR), and text.
 */
import { decodeSpreadsheet, parseCsv } from './legacy-import.js';

const XLSX_SRC = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
const JSZIP_SRC = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const PDF_SRC = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDF_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

export function csvCell(s) {
  const t = String(s ?? '');
  return /[",\n\r;]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

export function matrixToCsv(matrix) {
  return (matrix || []).map((r) => (r || []).map(csvCell).join(',')).join('\n');
}

function u8of(buf) {
  if (!buf) return new Uint8Array(0);
  if (buf instanceof Uint8Array) return buf;
  if (buf instanceof ArrayBuffer) return new Uint8Array(buf);
  if (ArrayBuffer.isView(buf)) return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  return new TextEncoder().encode(String(buf));
}

function sliceBuf(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((s) => s.src === src)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load ' + src.split('/').pop()));
    document.head.appendChild(s);
  });
}

function looksHtml(text) {
  const t = String(text || '').slice(0, 4000).toLowerCase();
  return /<html|<table|<tr[\s>]|<worksheet|<workbook/.test(t);
}

function parseHtmlMatrix(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const tables = [...doc.querySelectorAll('table')];
  const best = tables.sort((a, b) => (b.rows?.length || 0) - (a.rows?.length || 0))[0];
  if (!best) return [];
  return [...best.rows].map((tr) => [...tr.cells].map((td) => String(td.innerText || td.textContent || '').replace(/\s+/g, ' ').trim()))
    .filter((r) => r.some((c) => c));
}

function parseSpreadsheetMl(xml) {
  const doc = new DOMParser().parseFromString(String(xml || ''), 'text/xml');
  const rows = [...doc.getElementsByTagName('Row')];
  if (!rows.length) return [];
  return rows.map((row) => {
    const cells = [...row.getElementsByTagName('Cell')];
    const out = [];
    cells.forEach((cell) => {
      const idx = Number(cell.getAttribute('ss:Index') || cell.getAttribute('Index') || 0);
      const data = cell.getElementsByTagName('Data')[0];
      const val = String(data?.textContent || cell.textContent || '').replace(/\s+/g, ' ').trim();
      if (idx > 0) {
        while (out.length < idx - 1) out.push('');
        out[idx - 1] = val;
      } else out.push(val);
    });
    return out;
  }).filter((r) => r.some((c) => String(c || '').trim()));
}

function jsonToMatrix(raw) {
  let data;
  try { data = JSON.parse(raw); } catch { return []; }
  if (Array.isArray(data) && data.length && Array.isArray(data[0])) return data;
  if (data && Array.isArray(data.data) && data.data[0] && typeof data.data[0] === 'object') data = data.data;
  if (data && Array.isArray(data.rows)) data = data.rows;
  if (!Array.isArray(data) || !data.length) return [];
  if (typeof data[0] !== 'object' || data[0] == null) return [['value'], ...data.map((v) => [String(v)])];
  const keys = [];
  data.forEach((row) => Object.keys(row || {}).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
  return [keys, ...data.map((row) => keys.map((k) => {
    const v = row?.[k];
    if (v == null) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }))];
}

function csvMatrix(text) {
  return parseCsv(text);
}

function textToMatrix(text) {
  const csv = csvMatrix(text);
  if (csv.some((r) => r.length > 1)) return csv;
  return String(text || '').split(/\r?\n/).filter((l) => l.trim())
    .map((l) => l.split(/\s{2,}|\t/).map((s) => s.trim()).filter((s, i, a) => s || a.length === 1));
}

function localNodes(root, name) {
  return [...(root.getElementsByTagName?.('*') || [])].filter((n) => n.localName === name);
}

function cellText(node) {
  return localNodes(node, 't').map((n) => n.textContent || '').join('').replace(/\s+/g, ' ').trim()
    || String(node.textContent || '').replace(/\s+/g, ' ').trim();
}

function wordXmlToMatrix(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const tbls = localNodes(doc, 'tbl');
  if (tbls.length) {
    const tables = tbls.map((tbl) => localNodes(tbl, 'tr').map((tr) => localNodes(tr, 'tc').map(cellText)));
    return tables.sort((a, b) => b.length - a.length)[0] || [];
  }
  return localNodes(doc, 'p').map((p) => [cellText(p)]).filter((r) => r[0]);
}

function pptXmlToMatrix(xmls) {
  const tables = [];
  const lines = [];
  xmls.forEach((xml) => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    localNodes(doc, 'tbl').forEach((tbl) => {
      tables.push(localNodes(tbl, 'tr').map((tr) => localNodes(tr, 'tc').map(cellText)));
    });
    localNodes(doc, 't').forEach((t) => {
      const s = String(t.textContent || '').trim();
      if (s) lines.push([s]);
    });
  });
  if (tables.length) return tables.sort((a, b) => b.length - a.length)[0];
  return lines;
}

async function loadXlsx() {
  if (typeof window !== 'undefined' && window.XLSX) return window.XLSX;
  await loadScript(XLSX_SRC);
  return window.XLSX;
}

async function loadZip() {
  if (typeof window !== 'undefined' && window.JSZip) return window.JSZip;
  await loadScript(JSZIP_SRC);
  return window.JSZip;
}

async function xlsxMatrix(buf) {
  const XLSX = await loadXlsx();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true, raw: false });
  const name = wb.SheetNames[0];
  if (!name) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
}

function clusterPdfItems(items) {
  const rows = [];
  for (const it of items || []) {
    const str = String(it.str || '').trim();
    if (!str) continue;
    const x = it.transform ? it.transform[4] : 0;
    const y = it.transform ? Math.round(it.transform[5]) : 0;
    let row = rows.find((r) => Math.abs(r.y - y) <= 5);
    if (!row) { row = { y, cells: [] }; rows.push(row); }
    row.cells.push({ x, str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => {
    r.cells.sort((a, b) => a.x - b.x);
    const cells = [];
    r.cells.forEach((c) => {
      const last = cells[cells.length - 1];
      if (last && (c.x - last.xEnd) < 14) {
        last.str += (/\s$/.test(last.str) ? '' : ' ') + c.str;
        last.xEnd = c.x + Math.max(8, c.str.length * 4.2);
      } else {
        cells.push({ str: c.str, xEnd: c.x + Math.max(8, c.str.length * 4.2) });
      }
    });
    return cells.map((c) => c.str);
  }).filter((r) => r.some((c) => c));
}

async function pdfMatrix(buf, onProgress) {
  onProgress?.('Opening PDF…');
  const pdfjs = await import(/* @vite-ignore */ PDF_SRC);
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER;
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const all = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    onProgress?.('PDF page ' + p + ' of ' + doc.numPages);
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    all.push(...clusterPdfItems(content.items));
  }
  return all;
}

async function zipMatrix(buf, filename, onProgress) {
  onProgress?.('Opening Office file…');
  const JSZip = await loadZip();
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files);
  if (names.some((n) => n.startsWith('word/')) || /\.docx$/.test(filename)) {
    const xml = await zip.file('word/document.xml')?.async('string');
    if (!xml) return [];
    return wordXmlToMatrix(xml);
  }
  if (names.some((n) => n.startsWith('ppt/')) || /\.pptx$/.test(filename)) {
    const slides = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n)).sort();
    const xmls = [];
    for (const n of slides) xmls.push(await zip.file(n).async('string'));
    return pptXmlToMatrix(xmls);
  }
  if (names.some((n) => n.startsWith('xl/')) || /\.xlsx$|\.xlsm$|\.ods$/.test(filename)) {
    return xlsxMatrix(buf);
  }
  return [];
}

function isImageName(name, mime = '') {
  return /\.(png|jpe?g|gif|webp|bmp|tiff?|heic|avif)$/i.test(name)
    || /^image\//.test(mime);
}

function imageMime(name, mime) {
  if (mime && /^image\//.test(mime)) return mime;
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.webp$/i.test(name)) return 'image/webp';
  if (/\.gif$/i.test(name)) return 'image/gif';
  if (/\.bmp$/i.test(name)) return 'image/bmp';
  if (/\.tiff?$/i.test(name)) return 'image/tiff';
  return 'image/jpeg';
}

async function imageMatrix(buf, filename, mime, onProgress) {
  onProgress?.('Reading text from image… this can take a minute');
  if (typeof window === 'undefined' || !window.Tesseract) await loadScript(TESSERACT_SRC);
  const blob = new Blob([buf], { type: imageMime(filename, mime) });
  const { data } = await window.Tesseract.recognize(blob, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.('OCR ' + Math.round((m.progress || 0) * 100) + '%');
    },
  });
  if (data.lines?.length) {
    const rows = data.lines.map((line) => {
      const words = (line.words || []).map((w) => String(w.text || '').trim()).filter(Boolean);
      if (words.length > 1) return words;
      return String(line.text || '').trim().split(/\s{2,}|\t/).filter(Boolean);
    }).filter((r) => r.length);
    if (rows.length) return rows;
  }
  return textToMatrix(data.text || '');
}

function finish(matrix, format) {
  const clean = (matrix || []).map((r) => (r || []).map((c) => String(c ?? '').trim()));
  while (clean.length && !clean[0].some((c) => c)) clean.shift();
  return {
    format,
    matrix: clean,
    header: clean[0] || [],
    rows: clean.slice(1),
    text: matrixToCsv(clean),
    count: Math.max(0, clean.length - 1),
  };
}

export async function tableFromBytes(buf, filename = '', opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const name = String(filename || '').toLowerCase();
  const bytes = u8of(buf);
  const copy = sliceBuf(bytes);
  const magic = [...bytes.slice(0, 8)];
  const isZip = magic[0] === 0x50 && magic[1] === 0x4B;
  const isOle = magic[0] === 0xD0 && magic[1] === 0xCF;
  const isPdf = magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 && magic[3] === 0x46;
  const isPng = magic[0] === 0x89 && magic[1] === 0x50;
  const isJpg = magic[0] === 0xFF && magic[1] === 0xD8;
  const isGif = magic[0] === 0x47 && magic[1] === 0x49;
  const isWebp = magic[0] === 0x52 && magic[8] === undefined && bytes[8] === 0x57;
  const isImg = isPng || isJpg || isGif || isImageName(name, opts.mime);

  if (isPdf || /\.pdf$/.test(name)) {
    try { return finish(await pdfMatrix(copy, onProgress), 'pdf'); }
    catch (err) { throw new Error('Could not read PDF: ' + (err.message || err)); }
  }
  if (isImg) {
    try { return finish(await imageMatrix(copy, name, opts.mime, onProgress), 'image-ocr'); }
    catch (err) { throw new Error('Could not read image: ' + (err.message || err)); }
  }
  if (isZip || /\.docx$|\.pptx$|\.xlsx$|\.xlsm$|\.ods$/.test(name)) {
    if (/\.docx$|\.pptx$/.test(name) || isZip) {
      try {
        const office = await zipMatrix(copy, name, onProgress);
        if (office.length) {
          const kind = /\.pptx$/.test(name) ? 'pptx' : (/\.docx$/.test(name) ? 'docx' : 'office');
          return finish(office, kind);
        }
      } catch { /* fall through to excel */ }
    }
    try {
      return finish(await xlsxMatrix(copy), isZip ? 'xlsx' : 'xls');
    } catch {
      const text = decodeSpreadsheet(bytes);
      if (looksHtml(text)) {
        let matrix = parseHtmlMatrix(text);
        if (!matrix.length) matrix = parseSpreadsheetMl(text);
        return finish(matrix, 'excel-html');
      }
      return finish(csvMatrix(text), 'xls-csv');
    }
  }
  if (isOle) {
    try { return finish(await xlsxMatrix(copy), 'xls'); }
    catch {
      throw new Error('This is an old Word/PowerPoint (.doc / .ppt). Save as .docx, .pptx, or PDF and stage that.');
    }
  }

  const text = decodeSpreadsheet(bytes);
  const trimmed = text.trim();
  if (/\.json$/.test(name) || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    let matrix = jsonToMatrix(trimmed);
    if (!matrix.length && looksHtml(trimmed)) matrix = parseHtmlMatrix(trimmed);
    return finish(matrix, 'json');
  }
  if (looksHtml(trimmed) || /\.html?$/.test(name)) {
    let matrix = parseHtmlMatrix(trimmed);
    if (!matrix.length) matrix = parseSpreadsheetMl(trimmed);
    if (!matrix.length) matrix = csvMatrix(text);
    return finish(matrix, 'html');
  }
  return finish(textToMatrix(text), /\.txt$/.test(name) ? 'text' : (/[\t]/.test(text.slice(0, 200)) ? 'tsv' : 'csv'));
}

export async function tableFromFile(file, onProgress) {
  if (!file) return finish([], 'empty');
  const buf = await file.arrayBuffer();
  return tableFromBytes(buf, file.name || '', { onProgress, mime: file.type });
}

export async function tableFromText(text, filename = 'paste.csv') {
  return tableFromBytes(new TextEncoder().encode(String(text || '')), filename);
}
