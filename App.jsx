import React, { useState, useEffect, useRef, useCallback } from "react";
import { storage } from "./storage.js";
import {
  Camera,
  Check,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Coins,
  ScanLine,
  Sparkles,
  Share2,
  ClipboardCopy,
  Settings,
  ExternalLink,
} from "lucide-react";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@600;700&family=Sarabun:wght@400;500;600;700&display=swap');`;

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  productName: "",
  quantity: "",
  totalWeightBefore: "",
  weightAfter: "",
  percent: "",
  price: "",
  phone: "",
  technician: "",
  inspector: "",
  compositionAu: "",
  compositionAg: "",
  compositionCu: "",
  note: "",
  productPhoto: null,
  weightPhoto: null,
  cardPhoto: null,
};

const CARD_PROMPT = `นี่คือรูปถ่ายบัตรบันทึกรายการหลอมทองที่เขียนด้วยลายมือ (ภาษาไทย) อ่านข้อมูลทั้งหมดในบัตรแล้วตอบกลับเป็น JSON เท่านั้น (ห้ามมีข้อความอื่น ห้ามใส่ backtick หรือ markdown) ตาม schema นี้:

{
  "date": "YYYY-MM-DD หรือ null",
  "productName": "ชื่อสินค้าก่อนหลอม หรือ null",
  "quantity": "จำนวนชิ้น (ตัวเลข) หรือ null",
  "totalWeightBefore": "นน.รวมก่อนหลอม เป็นตัวเลข (กรัม) หรือ null",
  "weightAfter": "นน.หลังหลอม เป็นตัวเลข (กรัม) หรือ null",
  "percent": "เปอร์เซ็นต์ทองหลังหลอม เป็นตัวเลข หรือ null",
  "price": "ราคา เป็นตัวเลข หรือ null",
  "phone": "เบอร์โทร หรือ null",
  "technician": "ชื่อช่างหลอม หรือ null",
  "inspector": "ชื่อผู้ทำรายการ หรือ null",
  "compositionAu": "เปอร์เซ็นต์ Au ถ้ามีเขียนแยกไว้ต่างหาก หรือ null",
  "compositionAg": "เปอร์เซ็นต์ Ag ถ้ามี หรือ null",
  "compositionCu": "เปอร์เซ็นต์ Cu ถ้ามี หรือ null",
  "note": "ข้อความอื่นที่เขียนเพิ่มเติมซึ่งไม่เข้าฟิลด์ไหนเลย (เช่น รหัส/ป้ายกำกับชิ้นงาน) หรือ null"
}

กติกาสำคัญ:
- ปีที่เขียนในบัตรมักเป็นปี พ.ศ. แบบย่อ (เช่น 27/8/69 หมายถึงวันที่ 27 สิงหาคม พ.ศ. 2569) ให้แปลงเป็นปี ค.ศ. โดยลบ 543 จากปี พ.ศ. เต็ม แล้วตอบในรูปแบบ YYYY-MM-DD เสมอ
- ถ้าตัวเลขหรือลายมือไม่ชัดเจน ให้เดาที่เป็นไปได้มากที่สุด แต่ถ้าอ่านไม่ออกจริง ๆ ให้ใส่ null
- ตอบเฉพาะ JSON object เท่านั้น ไม่ต้องมีคำอธิบายใด ๆ`;

const SCALE_PROMPT = `ภาพนี้คือหน้าจอตาชั่งดิจิทัลที่กำลังแสดงตัวเลขน้ำหนัก อ่านตัวเลขบนจอแสดงผล (ปกติเป็นตัวเลขสีน้ำเงินหรือเขียวบนพื้น LCD) แล้วตอบกลับเป็น JSON เท่านั้น (ห้ามมีข้อความอื่น ห้ามใส่ backtick) ในรูปแบบ:
{"weight": ตัวเลขทศนิยม หรือ null, "unit": "g"}
ถ้าไม่มีจอตาชั่งอยู่ในภาพ หรืออ่านตัวเลขไม่ออกจริง ๆ ให้ตอบ {"weight": null, "unit": null}`;

function loadHeic2Any() {
  return new Promise((resolve, reject) => {
    if (window.heic2any) {
      resolve(window.heic2any);
      return;
    }
    const existing = document.querySelector("script[data-heic2any]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.heic2any));
      existing.addEventListener("error", () => reject(new Error("โหลดตัวแปลงไฟล์ HEIC ไม่สำเร็จ")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.1/index.min.js";
    script.setAttribute("data-heic2any", "true");
    script.onload = () => resolve(window.heic2any);
    script.onerror = () => reject(new Error("โหลดตัวแปลงไฟล์ HEIC ไม่สำเร็จ (เครือข่ายอาจถูกจำกัด)"));
    document.head.appendChild(script);
  });
}

async function convertHeicIfNeeded(file) {
  const isHeic = /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name || "");
  if (!isHeic) return file;
  try {
    const heic2any = await loadHeic2Any();
    const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
    return Array.isArray(result) ? result[0] : result;
  } catch (e) {
    throw new Error(
      "แปลงไฟล์ HEIC ไม่สำเร็จ — ลองเปลี่ยนตั้งค่ากล้อง iPhone เป็น 'Most Compatible' (Settings > Camera > Formats) แล้วถ่ายใหม่ หรือเลือกรูปที่เป็น JPG/PNG แทน"
    );
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("อ่านไฟล์ภาพไม่สำเร็จ"));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function compressImage(file, maxDim = 900, quality = 0.62) {
  const workingFile = await convertHeicIfNeeded(file);
  const dataUrlIn = await readFileAsDataUrl(workingFile);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => {
      reject(new Error(`โหลดภาพไม่สำเร็จ (ไฟล์ประเภท ${workingFile.type || "ไม่ทราบชนิด"})`));
    };
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // Photos picked from the library can be much larger/more detailed than a
      // fresh camera shot, and every photo on a record shares one 5MB storage
      // key, so shrink further (up to a few passes) until it's safely small.
      let q = quality;
      let dataUrl = canvas.toDataURL("image/jpeg", q);
      let attempts = 0;
      while (dataUrl.length > 700000 && attempts < 4) {
        q = Math.max(0.3, q - 0.15);
        dataUrl = canvas.toDataURL("image/jpeg", q);
        attempts++;
      }
      resolve(dataUrl);
    };
    img.src = dataUrlIn;
  });
}

function fmtDate(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function buildSheetTsvRow(r) {
  // Tab-separated so pasting straight into Google Sheets / Excel splits into columns
  // automatically. Order matches the columns in google-sheet-code.gs (minus timestamp,
  // which Sheets can add itself, and lineUserId which doesn't apply here).
  const cols = [
    r.date || "",
    r.productName || "",
    r.quantity || "",
    r.totalWeightBefore || "",
    r.weightAfter || "",
    r.percent || "",
    r.price || "",
    r.phone || "",
    r.technician || "",
    r.inspector || "",
    r.compositionAu || "",
    r.compositionAg || "",
    r.compositionCu || "",
    r.note || "",
  ];
  return cols.join("\t");
}

async function copyRecordForSheet(record) {
  const text = buildSheetTsvRow(record);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the manual fallback below
    }
  }
  // Fallback for environments where the Clipboard API is blocked (e.g. some
  // sandboxed iframes): select a hidden textarea and use execCommand.
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

function buildLineShareText(r) {
  const lines = [`วัชรินทร์โกลด์ / หลอมทอง`, `วันที่: ${fmtDate(r.date)}`];
  if (r.productName) lines.push(`สินค้า: ${r.productName}`);
  if (r.quantity) lines.push(`จำนวน: ${r.quantity} ชิ้น`);
  if (r.totalWeightBefore) lines.push(`นน.ก่อนหลอม: ${r.totalWeightBefore} กรัม`);
  if (r.weightAfter) lines.push(`นน.หลังหลอม: ${r.weightAfter} กรัม`);
  if (r.percent) lines.push(`เปอร์เซ็นต์: ${r.percent}%`);
  if (r.price) lines.push(`ราคา: ${r.price} บาท`);
  if (r.technician) lines.push(`ช่างหลอม: ${r.technician}`);
  if (r.inspector) lines.push(`ผู้ทำรายการ: ${r.inspector}`);
  return lines.join("\n");
}

async function sendToGoogleSheet(record, webhookUrl) {
  if (!webhookUrl) return { skipped: true };
  const slim = {
    date: record.date,
    productName: record.productName,
    quantity: record.quantity,
    totalWeightBefore: record.totalWeightBefore,
    weightAfter: record.weightAfter,
    percent: record.percent,
    price: record.price,
    phone: record.phone,
    technician: record.technician,
    inspector: record.inspector,
    compositionAu: record.compositionAu,
    compositionAg: record.compositionAg,
    compositionCu: record.compositionCu,
    note: record.note,
  };
  const url = `${webhookUrl}${webhookUrl.includes("?") ? "&" : "?"}data=${encodeURIComponent(JSON.stringify(slim))}`;
  // Apps Script never sends CORS headers back, so we still can't read the
  // response even on our own site — but unlike inside Claude's sandbox, the
  // request itself is no longer blocked by CSP, so it actually reaches Google.
  await fetch(url, { method: "GET", mode: "no-cors" });
  return { sent: true };
}

function shareToLine(record) {
  const text = buildLineShareText(record);
  const url = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function dataUrlParts(dataUrl) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!match) throw new Error("รูปแบบภาพไม่ถูกต้อง");
  return { mediaType: match[1], base64: match[2] };
}

async function askClaudeVision(dataUrl, promptText, apiKey) {
  if (!apiKey) throw new Error("ยังไม่ได้ใส่ Anthropic API key ในตั้งค่า ⚙️");
  const { mediaType, base64 } = dataUrlParts(dataUrl);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // Required to call the API directly from a browser; Anthropic normally
      // blocks this because it exposes the key client-side. Fine for a
      // personal single-user tool, not for anything you'd share publicly.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: promptText },
          ],
        },
      ],
    }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`เรียก AI ไม่สำเร็จ (HTTP ${response.status}) ${errText.slice(0, 150)}`);
  }
  const data = await response.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function PhotoSlot({ label, value, onCapture, onRemove, busy }) {
  const inputRef = useRef(null);
  return (
    <div className="photoSlot">
      <button
        type="button"
        className={`photoBtn ${value ? "taken" : ""}`}
        onClick={() => inputRef.current && inputRef.current.click()}
        disabled={busy}
      >
        {busy ? (
          <Loader2 size={18} className="spin" />
        ) : value ? (
          <Check size={18} />
        ) : (
          <Camera size={18} />
        )}
        <span>{value ? `${label} แล้ว` : `ถ่าย/อัปโหลดรูป${label}`}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          if (f) onCapture(f);
          e.target.value = "";
        }}
      />
      {value && (
        <div className="thumbWrap">
          <img src={value} alt={label} className="thumb" />
          <button type="button" className="thumbRemove" onClick={onRemove} title="ลบรูปนี้">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default function GoldMeltLog() {
  const [form, setForm] = useState(emptyForm);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState({ product: false, weight: false, card: false });
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [aiNotice, setAiNotice] = useState("");
  const [sheetCopyStatus, setSheetCopyStatus] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({ apiKey: "", sheetUrl: "" });
  const cardInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get("settings");
        const s = res ? JSON.parse(res.value) : {};
        setApiKey(s.apiKey || "");
        setSheetUrl(s.sheetUrl || "");
        setSettingsDraft({ apiKey: s.apiKey || "", sheetUrl: s.sheetUrl || "" });
      } catch {
        // no settings saved yet
      }
    })();
  }, []);

  const saveSettings = async () => {
    const next = { apiKey: settingsDraft.apiKey.trim(), sheetUrl: settingsDraft.sheetUrl.trim() };
    await storage.set("settings", JSON.stringify(next));
    setApiKey(next.apiKey);
    setSheetUrl(next.sheetUrl);
    setShowSettings(false);
  };

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const idxRes = await storage.get("gold-melt:index").catch(() => null);
      const ids = idxRes ? JSON.parse(idxRes.value) : [];
      const items = [];
      for (const id of ids) {
        try {
          const r = await storage.get(`gold-melt:record:${id}`);
          if (r) items.push({ ...JSON.parse(r.value), _persisted: true });
        } catch {
          // skip missing/corrupt record
        }
      }
      items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      setRecords(items);
    } catch (e) {
      setError("โหลดข้อมูลที่บันทึกไว้ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const setField = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const tryReadScale = async (dataUrl, targetField, fieldLabel) => {
    try {
      const result = await askClaudeVision(dataUrl, SCALE_PROMPT, apiKey);
      if (result && result.weight !== null && result.weight !== undefined) {
        setForm((f) => {
          if (f[targetField]) return f; // don't overwrite a value the user already entered
          return { ...f, [targetField]: String(result.weight) };
        });
        setAiNotice(`อ่านน้ำหนักจากรูปได้ ${result.weight} กรัม — เติมให้ในช่อง ${fieldLabel} แล้ว กรุณาตรวจสอบอีกครั้ง`);
        setTimeout(() => setAiNotice(""), 4500);
      }
    } catch {
      // best-effort only; silently skip if the photo isn't a scale readout
    }
  };

  const handlePhoto = async (which, file) => {
    setPhotoBusy((b) => ({ ...b, [which]: true }));
    setError("");
    try {
      const dataUrl = await compressImage(file);
      if (which === "product") {
        setField("productPhoto", dataUrl);
        tryReadScale(dataUrl, "totalWeightBefore", "นน.รวม (ก่อนหลอม)");
      } else {
        setField("weightPhoto", dataUrl);
        tryReadScale(dataUrl, "weightAfter", "นน. (หลังหลอม)");
      }
    } catch (e) {
      setError(`บันทึกรูปไม่สำเร็จ: ${e.message || "ไม่ทราบสาเหตุ"} ลองใหม่หรือเลือกรูปอื่น`);
    } finally {
      setPhotoBusy((b) => ({ ...b, [which]: false }));
    }
  };

  const handleCardScan = async (file) => {
    setPhotoBusy((b) => ({ ...b, card: true }));
    setError("");
    setAiNotice("");
    try {
      const dataUrl = await compressImage(file, 1400, 0.75);
      setField("cardPhoto", dataUrl);
      const extracted = await askClaudeVision(dataUrl, CARD_PROMPT, apiKey);
      const filled = [];
      setForm((f) => {
        const next = { ...f };
        const maybeSet = (key, label) => {
          const v = extracted[key];
          if (v !== null && v !== undefined && v !== "") {
            next[key] = String(v);
            filled.push(label);
          }
        };
        if (extracted.date && /^\d{4}-\d{2}-\d{2}$/.test(extracted.date)) {
          next.date = extracted.date;
          filled.push("วันที่");
        }
        maybeSet("productName", "สินค้า");
        maybeSet("quantity", "จำนวน");
        maybeSet("totalWeightBefore", "นน.รวม");
        maybeSet("weightAfter", "นน.หลังหลอม");
        maybeSet("percent", "เปอร์เซ็นต์");
        maybeSet("price", "ราคา");
        maybeSet("phone", "เบอร์โทร");
        maybeSet("technician", "ช่างหลอม");
        maybeSet("inspector", "ผู้ทำรายการ");
        maybeSet("compositionAu", "Au");
        maybeSet("compositionAg", "Ag");
        maybeSet("compositionCu", "Cu");
        maybeSet("note", "หมายเหตุ");
        return next;
      });
      setAiNotice(
        filled.length
          ? `AI กรอกข้อมูลจากบัตรให้แล้ว (${filled.join(", ")}) กรุณาตรวจสอบความถูกต้องก่อนบันทึก`
          : "อ่านบัตรไม่พบข้อมูลที่ชัดเจน กรุณากรอกด้วยตนเอง"
      );
    } catch (e) {
      setError(e.message || "อ่านข้อมูลจากบัตรไม่สำเร็จ กรุณากรอกด้วยตนเอง หรือลองถ่ายรูปให้ชัดขึ้น");
    } finally {
      setPhotoBusy((b) => ({ ...b, card: false }));
    }
  };

  const resetForm = () => setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });

  const handleSave = async () => {
    if (!form.productName.trim()) {
      setError("กรุณากรอกชื่อสินค้าก่อนบันทึก");
      return;
    }
    setSaving(true);
    setError("");
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = { ...form, id, createdAt: new Date().toISOString() };
    let persisted = false;
    try {
      const setRes = await storage.set(`gold-melt:record:${id}`, JSON.stringify(record));
      if (setRes) {
        const idxRes = await storage.get("gold-melt:index").catch(() => null);
        const ids = idxRes ? JSON.parse(idxRes.value) : [];
        ids.unshift(id);
        const idxSetRes = await storage.set("gold-melt:index", JSON.stringify(ids));
        persisted = !!idxSetRes;
      }
    } catch (e) {
      persisted = false;
    }
    // Always keep the record visible for this session regardless of whether it
    // actually persisted — a storage failure shouldn't block using the app, it
    // should just prompt copying the row to the sheet right away instead.
    setRecords((prev) => [{ ...record, _persisted: persisted }, ...prev]);
    resetForm();
    setAiNotice("");
    setLastSaved(record);
    if (persisted) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 6000);
    } else {
      setError(
        'บันทึกไว้ในหน้านี้แล้ว (ดูรายการด้านล่างได้) แต่ยังไม่ได้เซฟถาวร เพราะระบบเก็บข้อมูลของเบราว์เซอร์ขัดข้องอยู่ตอนนี้ (เช่น อยู่ใน Private/Incognito mode) — กด "คัดลอกไปวาง Sheet" ทันทีเพื่อไม่ให้ข้อมูลหาย'
      );
    }
    if (sheetUrl) {
      sendToGoogleSheet(record, sheetUrl).catch(() => {
        // best-effort; the "คัดลอกไปวาง Sheet" button is always the reliable fallback
      });
    }
    setSaving(false);
  };

  const handleCopyForSheet = async (record) => {
    const ok = await copyRecordForSheet(record);
    setSheetCopyStatus(
      ok
        ? "คัดลอกแล้ว! ไปวางในแถวว่างของ Google Sheet ได้เลย (Ctrl+V หรือ Cmd+V) ข้อมูลจะแยกช่องให้อัตโนมัติ"
        : "คัดลอกไม่สำเร็จ ลองแตะค้างที่ปุ่มแล้วเลือกคัดลอกเอง"
    );
    setTimeout(() => setSheetCopyStatus(""), 6000);
  };

  const handleDelete = async (id) => {
    try {
      await storage.delete(`gold-melt:record:${id}`).catch(() => null);
      const idxRes = await storage.get("gold-melt:index").catch(() => null);
      const ids = idxRes ? JSON.parse(idxRes.value) : [];
      const next = ids.filter((x) => x !== id);
      await storage.set("gold-melt:index", JSON.stringify(next));
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError("ลบรายการไม่สำเร็จ");
    }
  };

  return (
    <div className="wrap">
      <style>{`
        ${FONT_IMPORT}
        * { box-sizing: border-box; }
        .wrap {
          min-height: 100vh;
          background: radial-gradient(ellipse at top, #201a12 0%, #120f0b 55%, #0c0a08 100%);
          color: #f1e7d2;
          font-family: 'Sarabun', system-ui, sans-serif;
          padding: 28px 16px 60px;
        }
        .header {
          max-width: 640px;
          margin: 0 auto 22px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .coin {
          width: 42px; height: 42px;
          border-radius: 50%;
          background: linear-gradient(140deg, #e8b84b, #a9762a 70%);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 0 2px #382c17, 0 4px 10px rgba(0,0,0,0.5);
          flex-shrink: 0;
        }
        .titleBlock h1 {
          font-family: 'Kanit', sans-serif;
          font-weight: 700;
          font-size: 26px;
          letter-spacing: 0.3px;
          margin: 0;
          color: #f3e6c6;
          text-shadow: 0 1px 0 rgba(0,0,0,0.4);
        }
        .titleBlock p {
          margin: 2px 0 0;
          font-size: 13.5px;
          color: #b7a37a;
        }
        .gearBtn {
          margin-left: auto;
          background: transparent;
          border: 1px solid #3a2f1c;
          color: #d9c799;
          width: 36px; height: 36px;
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .gearBtn:hover { border-color: #6b5a34; }
        .settingsPanel {
          max-width: 640px;
          margin: 0 auto 14px;
          background: #1c1710;
          border: 1px solid #3a2f1c;
          border-radius: 12px;
          padding: 14px 16px;
        }
        .settingsTitle {
          font-family: 'Kanit', sans-serif;
          font-size: 14.5px;
          color: #f0dfae;
          margin-bottom: 4px;
        }
        .settingsHint {
          font-size: 12.5px;
          color: #8a7850;
          margin: 0 0 10px;
          line-height: 1.5;
        }
        .settingsInput {
          width: 100%;
          background: #120f0b;
          border: 1px solid #3a2f1c;
          color: #f1e7d2;
          font-size: 13px;
          padding: 8px 10px;
          border-radius: 8px;
          outline: none;
        }
        .settingsActions {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 10px;
          flex-wrap: wrap;
        }
        .settingsSaveBtn {
          background: linear-gradient(180deg, #f0c96a, #d9a233);
          color: #2b2005;
          font-family: 'Kanit', sans-serif;
          font-weight: 600;
          font-size: 13px;
          border: none;
          padding: 8px 14px;
          border-radius: 8px;
          cursor: pointer;
        }
        .settingsTestBtn {
          display: flex; align-items: center; gap: 6px;
          background: transparent;
          border: 1px solid #6b5a34;
          color: #d9c799;
          font-size: 12.5px;
          padding: 7px 12px;
          border-radius: 8px;
          cursor: pointer;
          text-decoration: none;
        }
        .card {
          max-width: 640px;
          margin: 0 auto 18px;
          background: linear-gradient(180deg, #efe6d2 0%, #e6dabd 100%);
          color: #2b2416;
          border-radius: 14px;
          padding: 20px 18px 18px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.45), 0 0 0 1px #4a3b1e33;
          position: relative;
        }
        .card::before {
          content: "";
          position: absolute;
          left: 18px; right: 18px; top: 0;
          height: 4px;
          background: linear-gradient(90deg, #d9a233, #f0c96a 50%, #d9a233);
          border-radius: 0 0 6px 6px;
        }
        .scanRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          background: #2b2416;
          border-radius: 10px;
          padding: 10px 12px;
          margin-bottom: 16px;
        }
        .scanRow .scanText {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #f0dfae;
          font-size: 13.5px;
        }
        .scanBtn {
          display: flex;
          align-items: center;
          gap: 7px;
          background: linear-gradient(180deg, #f0c96a, #d9a233);
          color: #2b2005;
          font-family: 'Kanit', sans-serif;
          font-weight: 600;
          font-size: 13.5px;
          border: none;
          padding: 8px 13px;
          border-radius: 8px;
          cursor: pointer;
          white-space: nowrap;
        }
        .scanBtn:disabled { opacity: 0.65; cursor: default; }
        .cardThumb {
          width: 30px; height: 30px;
          border-radius: 6px;
          object-fit: cover;
          border: 1px solid #4a3b1e;
        }
        .sectionLabel {
          display: inline-block;
          font-family: 'Kanit', sans-serif;
          font-weight: 600;
          font-size: 14px;
          background: #f0a53c;
          color: #2b2005;
          padding: 3px 10px;
          border-radius: 3px;
          margin-bottom: 10px;
          transform: rotate(-0.4deg);
        }
        .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0 18px;
        }
        .grid3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0 14px;
        }
        @media (max-width: 460px) {
          .grid2 { grid-template-columns: 1fr; gap: 14px 0; }
          .grid3 { grid-template-columns: 1fr; gap: 10px 0; }
        }
        .field {
          margin-bottom: 12px;
        }
        .field label {
          display: block;
          font-size: 13px;
          color: #6b5a34;
          margin-bottom: 3px;
        }
        .field .inputRow {
          display: flex;
          align-items: baseline;
          gap: 6px;
          border-bottom: 1.5px dotted #8a794f;
          padding-bottom: 3px;
        }
        .field input {
          flex: 1;
          border: none;
          background: transparent;
          font-family: 'Sarabun', sans-serif;
          font-size: 15.5px;
          color: #241f10;
          outline: none;
          padding: 2px 0;
          min-width: 0;
        }
        .field input::placeholder { color: #a5926a; }
        .unit {
          font-size: 13px;
          color: #8a794f;
          white-space: nowrap;
        }
        .photoRow {
          display: flex;
          gap: 10px;
          margin: 14px 0 4px;
          flex-wrap: wrap;
        }
        .photoSlot {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .photoBtn {
          display: flex;
          align-items: center;
          gap: 6px;
          border: 1.5px solid #8a794f;
          background: transparent;
          color: #4a3d1f;
          font-family: 'Sarabun', sans-serif;
          font-size: 13px;
          padding: 7px 11px;
          border-radius: 8px;
          cursor: pointer;
        }
        .photoBtn.taken {
          background: #3f6b3f;
          border-color: #3f6b3f;
          color: #eef7ea;
        }
        .photoBtn:disabled { opacity: 0.6; cursor: default; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .thumb {
          width: 34px; height: 34px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid #8a794f66;
        }
        .thumbWrap {
          position: relative;
          display: inline-flex;
        }
        .thumbRemove {
          position: absolute;
          top: -7px; right: -7px;
          width: 18px; height: 18px;
          border-radius: 50%;
          background: #7a2e2e;
          color: #fff;
          border: 1.5px solid #efe6d2;
          font-size: 13px;
          line-height: 1;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          padding: 0;
        }
        .divider {
          height: 1px;
          background: #8a794f55;
          margin: 16px 0;
        }
        .compHint {
          font-size: 12px;
          color: #8a794f;
          margin: 2px 0 8px;
        }
        .saveBtn {
          width: 100%;
          margin-top: 6px;
          background: linear-gradient(180deg, #2b2419, #171207);
          color: #f0dfae;
          font-family: 'Kanit', sans-serif;
          font-weight: 600;
          font-size: 16px;
          letter-spacing: 0.3px;
          padding: 13px;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        }
        .saveBtn:disabled { opacity: 0.65; cursor: default; }
        .errMsg {
          max-width: 640px;
          margin: 0 auto 12px;
          background: #4a1f1f;
          color: #f3caca;
          border: 1px solid #7a2e2e;
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 13.5px;
        }
        .flash {
          max-width: 640px;
          margin: 0 auto 12px;
          background: #1f4a2b;
          color: #cdf3d6;
          border: 1px solid #2e7a45;
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 13.5px;
        }
        .aiFlash {
          max-width: 640px;
          margin: 0 auto 12px;
          background: #3a2f14;
          color: #f0dfae;
          border: 1px solid #7a5e2e;
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 13.5px;
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }
        .listTitle {
          max-width: 640px;
          margin: 26px auto 10px;
          font-family: 'Kanit', sans-serif;
          font-size: 16px;
          color: #d9c799;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .listTitle span.count {
          font-size: 12.5px;
          color: #8a7850;
        }
        .recList { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
        .recCard {
          background: #1c1710;
          border: 1px solid #3a2f1c;
          border-radius: 12px;
          overflow: hidden;
        }
        .recHead {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          cursor: pointer;
        }
        .recDate {
          font-size: 12px;
          color: #a08e5f;
          min-width: 76px;
        }
        .recMain { flex: 1; min-width: 0; }
        .recMain .name {
          font-size: 15px;
          color: #f1e7d2;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .recMain .sub {
          font-size: 12.5px;
          color: #8a7850;
        }
        .recChev { color: #8a7850; flex-shrink: 0; }
        .recBody {
          padding: 0 14px 14px;
          border-top: 1px dashed #3a2f1c;
        }
        .kv { display: flex; justify-content: space-between; font-size: 13.5px; padding: 6px 0; border-bottom: 1px solid #241d13; }
        .kv span:first-child { color: #8a7850; }
        .kv span:last-child { color: #f1e7d2; text-align: right; }
        .recImgs { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
        .recImgs img { width: 72px; height: 72px; object-fit: cover; border-radius: 8px; border: 1px solid #3a2f1c; }
        .delBtn {
          margin-top: 12px;
          display: flex; align-items: center; gap: 6px;
          background: transparent;
          border: 1px solid #6b2f2f;
          color: #e3a3a3;
          font-size: 12.5px;
          padding: 7px 11px;
          border-radius: 8px;
          cursor: pointer;
        }
        .recActions { display: flex; gap: 8px; flex-wrap: wrap; }
        .tempBadge {
          display: inline-block;
          margin-left: 8px;
          font-size: 10.5px;
          font-weight: 600;
          color: #f0a53c;
          border: 1px solid #f0a53c;
          border-radius: 5px;
          padding: 1px 6px;
          vertical-align: middle;
        }
        .tempWarning {
          margin-top: 10px;
          background: #3a2414;
          border: 1px solid #7a4e2e;
          color: #f0c9a3;
          font-size: 12px;
          line-height: 1.5;
          padding: 8px 10px;
          border-radius: 8px;
        }
        .lineBtn {
          margin-top: 12px;
          display: flex; align-items: center; gap: 6px;
          background: #06c755;
          border: 1px solid #06c755;
          color: #ffffff;
          font-size: 12.5px;
          font-weight: 600;
          padding: 7px 11px;
          border-radius: 8px;
          cursor: pointer;
        }
        .copyBtn {
          margin-top: 12px;
          display: flex; align-items: center; gap: 6px;
          background: transparent;
          border: 1px solid #6b5a34;
          color: #d9c799;
          font-size: 12.5px;
          font-weight: 600;
          padding: 7px 11px;
          border-radius: 8px;
          cursor: pointer;
        }
        .empty { max-width: 640px; margin: 12px auto; color: #8a7850; font-size: 13.5px; text-align: center; padding: 20px; }
        .loadingRow { max-width: 640px; margin: 12px auto; color: #8a7850; font-size: 13.5px; display: flex; align-items: center; gap: 8px; justify-content: center; }
      `}</style>

      <div className="header">
        <div className="coin"><Coins size={20} color="#3a2c0e" /></div>
        <div className="titleBlock">
          <h1>วัชรินทร์โกลด์</h1>
          <p>บันทึกรายการหลอมทอง — ก่อนหลอม / หลังหลอม</p>
        </div>
        <button
          type="button"
          className="gearBtn"
          onClick={() => { setSettingsDraft({ apiKey, sheetUrl }); setShowSettings((s) => !s); }}
          title="ตั้งค่า"
        >
          <Settings size={18} />
        </button>
      </div>

      {showSettings && (
        <div className="settingsPanel">
          <div className="settingsTitle">Anthropic API key (สำหรับฟีเจอร์ AI สแกนบัตร/อ่านตาชั่ง)</div>
          <p className="settingsHint">
            ไม่บังคับ — ใส่เพื่อเปิดใช้ฟีเจอร์ AI เท่านั้น ส่วนอื่นของแอป (กรอกเอง/รูปภาพ/บันทึกถาวร/Sheet/LINE) ใช้ได้ปกติแม้ไม่ใส่ก็ตาม
            สร้างคีย์ได้ที่ console.anthropic.com (มีค่าใช้จ่ายตามการใช้งานจริง) คีย์นี้เก็บไว้ในเบราว์เซอร์นี้เท่านั้น
          </p>
          <input
            className="settingsInput"
            placeholder="sk-ant-..."
            type="password"
            value={settingsDraft.apiKey}
            onChange={(e) => setSettingsDraft((s) => ({ ...s, apiKey: e.target.value }))}
          />
          <div className="settingsTitle" style={{ marginTop: 14 }}>Google Sheet (ไม่บังคับ)</div>
          <p className="settingsHint">
            วางลิงก์ Web app URL จาก Google Apps Script ที่ผูกกับชีตของคุณ ทุกครั้งที่บันทึกรายการจะส่งข้อมูลไปเพิ่มแถวใหม่ให้อัตโนมัติ
          </p>
          <input
            className="settingsInput"
            placeholder="https://script.google.com/macros/s/xxxx/exec"
            value={settingsDraft.sheetUrl}
            onChange={(e) => setSettingsDraft((s) => ({ ...s, sheetUrl: e.target.value }))}
          />
          <div className="settingsActions">
            <button className="settingsSaveBtn" onClick={saveSettings}>บันทึกการตั้งค่า</button>
            {settingsDraft.sheetUrl.trim() && (
              <a className="settingsTestBtn" href={settingsDraft.sheetUrl.trim()} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} /> เปิดลิงก์เพื่อทดสอบ
              </a>
            )}
          </div>
        </div>
      )}

      {sheetCopyStatus && <div className="aiFlash"><ClipboardCopy size={16} style={{ flexShrink: 0, marginTop: 1 }} /><span>{sheetCopyStatus}</span></div>}

      {error && <div className="errMsg">{error}</div>}
      {savedFlash && (
        <div className="flash" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span>บันทึกรายการเรียบร้อยแล้ว</span>
          {lastSaved && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="lineBtn" style={{ margin: 0 }} onClick={() => shareToLine(lastSaved)}>
                <Share2 size={14} /> แชร์ไปยัง LINE
              </button>
              <button className="copyBtn" style={{ margin: 0 }} onClick={() => handleCopyForSheet(lastSaved)}>
                <ClipboardCopy size={14} /> คัดลอกไปวาง Sheet
              </button>
            </div>
          )}
        </div>
      )}
      {aiNotice && (
        <div className="aiFlash">
          <Sparkles size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{aiNotice}</span>
        </div>
      )}

      <div className="card">
        <div className="scanRow">
          <div className="scanText">
            {form.cardPhoto ? (
              <img src={form.cardPhoto} alt="บัตร" className="cardThumb" />
            ) : (
              <ScanLine size={16} />
            )}
            <span>ถ่ายหรืออัปโหลดรูปบัตรบันทึก ให้ AI ช่วยกรอกฟอร์มให้อัตโนมัติ{!apiKey && " (ต้องใส่ Anthropic API key ในตั้งค่า ⚙️ ก่อน)"}</span>
          </div>
          <button
            type="button"
            className="scanBtn"
            disabled={photoBusy.card}
            onClick={() => cardInputRef.current && cardInputRef.current.click()}
          >
            {photoBusy.card ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
            {photoBusy.card ? "กำลังอ่าน..." : form.cardPhoto ? "สแกนใหม่" : "สแกนบัตร"}
          </button>
          <input
            ref={cardInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              if (f) handleCardScan(f);
              e.target.value = "";
            }}
          />
        </div>

        <div className="field" style={{ maxWidth: 220 }}>
          <label>วันที่</label>
          <div className="inputRow">
            <input type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} />
          </div>
        </div>

        <div className="grid2">
          <div>
            <span className="sectionLabel">ก่อนหลอม</span>
            <div className="field">
              <label>สินค้า</label>
              <div className="inputRow">
                <input
                  placeholder="เช่น สร้อยคอลาย..."
                  value={form.productName}
                  onChange={(e) => setField("productName", e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label>จำนวน</label>
              <div className="inputRow">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={form.quantity}
                  onChange={(e) => setField("quantity", e.target.value)}
                />
                <span className="unit">ชิ้น</span>
              </div>
            </div>
            <div className="field">
              <label>นน.รวม</label>
              <div className="inputRow">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.totalWeightBefore}
                  onChange={(e) => setField("totalWeightBefore", e.target.value)}
                />
                <span className="unit">กรัม</span>
              </div>
            </div>
            <div className="photoRow">
              <PhotoSlot
                label="สินค้า"
                value={form.productPhoto}
                busy={photoBusy.product}
                onCapture={(f) => handlePhoto("product", f)}
                onRemove={() => setField("productPhoto", null)}
              />
            </div>
          </div>

          <div>
            <span className="sectionLabel">หลังหลอม</span>
            <div className="field">
              <label>นน.</label>
              <div className="inputRow">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.weightAfter}
                  onChange={(e) => setField("weightAfter", e.target.value)}
                />
                <span className="unit">กรัม</span>
              </div>
            </div>
            <div className="field">
              <label>เปอร์เซ็นต์</label>
              <div className="inputRow">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={form.percent}
                  onChange={(e) => setField("percent", e.target.value)}
                />
                <span className="unit">%</span>
              </div>
            </div>
            <div className="field">
              <label>ราคา</label>
              <div className="inputRow">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                />
                <span className="unit">บาท</span>
              </div>
            </div>
            <div className="photoRow">
              <PhotoSlot
                label="น้ำหนัก"
                value={form.weightPhoto}
                busy={photoBusy.weight}
                onCapture={(f) => handlePhoto("weight", f)}
                onRemove={() => setField("weightPhoto", null)}
              />
            </div>
          </div>
        </div>

        <div className="divider" />

        <span className="sectionLabel" style={{ background: "#c9a03f" }}>ผลวิเคราะห์โลหะ</span>
        <div className="compHint">กรอกเฉพาะกรณีมีผลตรวจแยกส่วนผสม (ไม่บังคับ)</div>
        <div className="grid3">
          <div className="field">
            <label>Au</label>
            <div className="inputRow">
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={form.compositionAu}
                onChange={(e) => setField("compositionAu", e.target.value)}
              />
              <span className="unit">%</span>
            </div>
          </div>
          <div className="field">
            <label>Ag</label>
            <div className="inputRow">
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={form.compositionAg}
                onChange={(e) => setField("compositionAg", e.target.value)}
              />
              <span className="unit">%</span>
            </div>
          </div>
          <div className="field">
            <label>Cu</label>
            <div className="inputRow">
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={form.compositionCu}
                onChange={(e) => setField("compositionCu", e.target.value)}
              />
              <span className="unit">%</span>
            </div>
          </div>
        </div>

        <div className="divider" />

        <div className="grid2">
          <div className="field">
            <label>เบอร์โทร</label>
            <div className="inputRow">
              <input value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>ช่างหลอม</label>
            <div className="inputRow">
              <input value={form.technician} onChange={(e) => setField("technician", e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>ผู้ทำรายการ</label>
            <div className="inputRow">
              <input value={form.inspector} onChange={(e) => setField("inspector", e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>หมายเหตุ</label>
            <div className="inputRow">
              <input value={form.note} onChange={(e) => setField("note", e.target.value)} />
            </div>
          </div>
        </div>

        <button className="saveBtn" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={18} className="spin" /> : <Check size={18} />}
          {saving ? "กำลังบันทึก..." : "บันทึกรายการ"}
        </button>
      </div>

      <div className="listTitle">
        <span>รายการที่บันทึกไว้</span>
        <span className="count">{records.length} รายการ</span>
      </div>

      {loading && (
        <div className="loadingRow"><Loader2 size={16} className="spin" /> กำลังโหลดข้อมูล...</div>
      )}

      {!loading && records.length === 0 && (
        <div className="empty">ยังไม่มีรายการที่บันทึกไว้ กรอกฟอร์มด้านบนแล้วกดบันทึกได้เลย</div>
      )}

      <div className="recList">
        {records.map((r) => {
          const isOpen = expanded === r.id;
          return (
            <div className="recCard" key={r.id}>
              <div className="recHead" onClick={() => setExpanded(isOpen ? null : r.id)}>
                <div className="recDate">{fmtDate(r.date)}</div>
                <div className="recMain">
                  <div className="name">
                    {r.productName || "(ไม่ระบุสินค้า)"}
                    {r._persisted === false && <span className="tempBadge">ชั่วคราว</span>}
                  </div>
                  <div className="sub">
                    {r.weightAfter ? `${r.weightAfter} กรัม` : "-"}
                    {r.price ? ` · ${r.price} บาท` : ""}
                  </div>
                </div>
                <div className="recChev">{isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div>
              </div>
              {isOpen && (
                <div className="recBody">
                  <div className="kv"><span>จำนวน</span><span>{r.quantity || "-"} ชิ้น</span></div>
                  <div className="kv"><span>นน.รวมก่อนหลอม</span><span>{r.totalWeightBefore || "-"} กรัม</span></div>
                  <div className="kv"><span>นน.หลังหลอม</span><span>{r.weightAfter || "-"} กรัม</span></div>
                  <div className="kv"><span>เปอร์เซ็นต์</span><span>{r.percent || "-"} %</span></div>
                  {(r.compositionAu || r.compositionAg || r.compositionCu) && (
                    <div className="kv">
                      <span>ส่วนผสม Au/Ag/Cu</span>
                      <span>{r.compositionAu || "-"} / {r.compositionAg || "-"} / {r.compositionCu || "-"}</span>
                    </div>
                  )}
                  <div className="kv"><span>ราคา</span><span>{r.price || "-"} บาท</span></div>
                  <div className="kv"><span>เบอร์โทร</span><span>{r.phone || "-"}</span></div>
                  <div className="kv"><span>ช่างหลอม</span><span>{r.technician || "-"}</span></div>
                  <div className="kv"><span>ผู้ทำรายการ</span><span>{r.inspector || "-"}</span></div>
                  {r.note && <div className="kv"><span>หมายเหตุ</span><span>{r.note}</span></div>}
                  {(r.cardPhoto || r.productPhoto || r.weightPhoto) && (
                    <div className="recImgs">
                      {r.cardPhoto && <img src={r.cardPhoto} alt="บัตร" />}
                      {r.productPhoto && <img src={r.productPhoto} alt="สินค้า" />}
                      {r.weightPhoto && <img src={r.weightPhoto} alt="น้ำหนัก" />}
                    </div>
                  )}
                  {r._persisted === false && (
                    <div className="tempWarning">
                      รายการนี้ยังไม่ได้บันทึกถาวร (ระบบเก็บข้อมูลขัดข้อง) — จะหายไปถ้าปิดหน้านี้ กด "คัดลอกไปวาง Sheet" ไว้ก่อนเพื่อความชัวร์
                    </div>
                  )}
                  <div className="recActions">
                    <button className="lineBtn" onClick={(e) => { e.stopPropagation(); shareToLine(r); }}>
                      <Share2 size={14} /> แชร์ไปยัง LINE
                    </button>
                    <button className="copyBtn" onClick={(e) => { e.stopPropagation(); handleCopyForSheet(r); }}>
                      <ClipboardCopy size={14} /> คัดลอกไปวาง Sheet
                    </button>
                    <button className="delBtn" onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}>
                      <Trash2 size={14} /> ลบรายการนี้
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
