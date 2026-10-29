"""
================================================================
  PILLAR 3 — VLM DERMATOLOGY REPORT GENERATOR
  Uses Gemini 3.0 Flash (multimodal) to generate a full
  professional dermatology report from:
    • Original image
    • Final annotated image (from Pillar 2)
    • ABCDE JSON report (from Pillar 2)
    • Pathology Excel knowledge base
    • User clinical prompt
  Output: Professional PDF report
================================================================
"""

import sys
import io
# Fix for Windows PowerShell emoji encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import os
import json
import argparse
import base64
import textwrap
import re
from pathlib import Path
from datetime import datetime

import time
import pandas as pd
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv(dotenv_path=Path(__file__).parent / ".env")
from PIL import Image

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image as RLImage, PageBreak, KeepTogether
)
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics import renderPDF

import warnings
warnings.filterwarnings("ignore")

# ──────────────────────────────────────────────
# 0. CONFIG
# ──────────────────────────────────────────────
GEMINI_API_KEY_PRIMARY = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_KEY_BACKUP  = os.getenv("GEMINI_API_KEY_BACKUP", "")
GEMINI_MODEL           = "gemini-3-flash-preview"
OUTPUT_DIR             = Path("reports")

_primary_label = "SET" if GEMINI_API_KEY_PRIMARY else "NOT SET"
print(f"[CONFIG] Primary key : {_primary_label}")
print(f"[CONFIG] Backup  key : {'SET' if GEMINI_API_KEY_BACKUP else 'NOT SET'}")
OUTPUT_DIR.mkdir(exist_ok=True)

# Brand colors
C_DARK    = colors.HexColor("#0d1b2a")
C_BLUE    = colors.HexColor("#1e3a5f")
C_ACCENT  = colors.HexColor("#2e86ab")
C_GREEN   = colors.HexColor("#1a7f5a")
C_ORANGE  = colors.HexColor("#d4590a")
C_RED     = colors.HexColor("#c0392b")
C_LIGHT   = colors.HexColor("#eaf4fb")
C_GRAY    = colors.HexColor("#f5f5f5")
C_TEXT    = colors.HexColor("#1a1a2a")
C_SUBTLE  = colors.HexColor("#6b7c93")


# ══════════════════════════════════════════════
# 1. LOAD INPUTS
# ══════════════════════════════════════════════

def load_abcde_json(json_path: str) -> list:
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_pathology_excel(excel_path: str) -> str:
    """
    Convert pathology Excel into a structured text summary
    that the VLM can use as a knowledge reference.
    """
    df = pd.read_excel(excel_path, header=0)
    df.columns = [str(c).strip() for c in df.columns]

    # Remove empty last column
    df = df.loc[:, df.columns.notna() & (df.columns != "None")]

    lines = ["=== PATHOLOGY KNOWLEDGE BASE (13 ECZEMA PROFILES) ===\n"]
    for _, row in df.iterrows():
        phase    = str(row.get("Phase", "")).strip()
        site     = str(row.get("Site anatomique", "")).strip()
        orient   = str(row.get("Phrase d'orientation clinique", "")).strip()
        diff     = str(row.get("Différentiels principaux considérés", "")).strip()
        trigger  = str(row.get("Contexte déclencheur (si connu)", "")).strip()
        erythema = str(row.get("Intensité de l'érythème (0–4)", "")).strip()
        lichi    = str(row.get("Lichenification (0–4)", "")).strip()
        prurit   = str(row.get("Prurit (0–4)", "")).strip()
        squames  = str(row.get("Type de squames (Fines/Épaisses/Adhérentes)", "")).strip()
        impact   = str(row.get("Impact IA (raison courte)", "")).strip()
        lines.append(
            f"• [{phase} | {site}] "
            f"Erythema={erythema}, Pruritus={prurit}, Lichenification={lichi}, "
            f"Scales={squames} | Trigger: {trigger} | "
            f"Differentials: {diff} | "
            f"AI note: {impact} | "
            f"Clinical orientation: {orient}"
        )
    return "\n".join(lines)


def encode_image_base64(image_path: str) -> tuple:
    """Return (base64_data, mime_type) for a local image."""
    ext  = Path(image_path).suffix.lower()
    mime = "image/jpeg" if ext in [".jpg", ".jpeg"] else "image/png"
    with open(image_path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    return data, mime


def build_abcde_summary(reports: list) -> str:
    """Convert ABCDE JSON list into clean readable text for VLM."""
    lines = []
    for r in reports:
        idx = r["region_index"]
        sv  = r.get("Severity", {})
        A   = r.get("A_Asymmetry", {})
        B   = r.get("B_Border", {})
        C   = r.get("C_Color", {})
        D   = r.get("D_Diameter", {})
        T   = r.get("Texture_Bonus", {})
        E   = r.get("E_Evolution", {})

        lines.append(f"\n--- REGION {idx} ---")
        lines.append(f"Severity Score    : {sv.get('score','N/A')}/10 — {sv.get('severity','N/A')}")
        lines.append(f"A - Asymmetry     : {A.get('label','N/A')} (H={A.get('horizontal_asymmetry','N/A')}, V={A.get('vertical_asymmetry','N/A')})")
        lines.append(f"B - Border        : {B.get('label','N/A')} (circularity={B.get('circularity','N/A')}, convexity={B.get('convexity_ratio','N/A')})")
        lines.append(f"C - Color         : {C.get('label','N/A')} (variation_std={C.get('color_variation_std','N/A')})")
        lines.append(f"    Colors found  : {', '.join(C.get('colors_detected',[]))}")
        lines.append(f"    Red fraction  : {C.get('red_fraction','N/A')} | Dark fraction: {C.get('dark_fraction','N/A')} | White fraction: {C.get('white_fraction','N/A')}")
        lines.append(f"D - Diameter      : {D.get('label','N/A')} (est. {D.get('estimated_diameter_px','N/A')}px, fill {D.get('fill_ratio','N/A')})")
        lines.append(f"T - Texture       : {T.get('label','N/A')} (GLCM contrast={T.get('glcm_contrast','N/A')}, roughness={T.get('roughness_index','N/A')})")
        lines.append(f"E - Evolution     : {E.get('label','N/A')}")
        if E.get("changes"):
            for k, v in E["changes"].items():
                if "trend" in k:
                    lines.append(f"    {k}: {v}")
    return "\n".join(lines)


# ══════════════════════════════════════════════
# 2. GEMINI VLM CALL
# ══════════════════════════════════════════════

SYSTEM_PROMPT = """You are an expert dermatologist and medical report writer with 20+ years of clinical experience in eczema (atopic dermatitis) and related skin pathologies.

You will receive:
1. An original skin image
2. A processed/annotated image showing detected lesion regions with severity scores
3. Quantitative ABCDE analysis from an AI image processing pipeline
4. A pathology knowledge base with 13 clinical eczema profiles
5. A patient/user clinical description

Your task: Write a comprehensive, professional yet PATIENT-FRIENDLY dermatology report in ENGLISH.

REPORT STRUCTURE (use exactly these section headers):
## EXECUTIVE SUMMARY
## PATIENT INFORMATION
## VISUAL ANALYSIS
## ABCDE CLINICAL ANALYSIS
## DIAGNOSIS
## DIFFERENTIAL DIAGNOSIS
## ECZEMA TYPE & PHASE
## SEVERITY ASSESSMENT
## RECOMMENDED TREATMENT PLAN
## LIFESTYLE & PREVENTION ADVICE
## WHEN TO SEE A DOCTOR
## FOLLOW-UP SCHEDULE
## MEDICAL DISCLAIMER

STRICT RULES:
- Write in clear, simple English that a patient without medical background can understand
- For technical terms, always add a simple explanation in parentheses
- Be specific, not generic — use the actual data from the ABCDE analysis
- The diagnosis section must clearly state if it IS eczema and what type
- Treatment must be practical: split into "Right Now", "This Week", "Long Term"
- The "When to See a Doctor" section must be direct and honest — if urgent, say so clearly
- Severity: use the 0-10 score from the ABCDE analysis
- Cross-reference with the pathology knowledge base to support your diagnosis
- If the image shows a baby or child, adapt recommendations accordingly
- End every major section with a plain-language "What this means for you:" sentence
"""

def resize_for_api(image_path: str, max_px: int = 768) -> Image.Image:
    """Resize image so longest side <= max_px to reduce token consumption."""
    img = Image.open(image_path).convert("RGB")
    w, h = img.size
    if max(w, h) > max_px:
        scale = max_px / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    return img


def call_gemini(
    original_image_path: str,
    annotated_image_path: str,
    abcde_summary: str,
    pathology_context: str,
    user_prompt: str,
    max_retries: int = 4,
) -> str:
    """Call Gemini 3.0 Flash with new google-genai SDK + auto retry on quota."""
    print("\n[🤖] Calling Gemini 3.0 Flash VLM...")

    # Build key list: primary (from .env) first, backup second
    keys_to_try = []
    if GEMINI_API_KEY_PRIMARY:
        keys_to_try.append(("primary", GEMINI_API_KEY_PRIMARY))
    if GEMINI_API_KEY_BACKUP:
        keys_to_try.append(("backup", GEMINI_API_KEY_BACKUP))
    if not keys_to_try:
        raise RuntimeError("GEMINI_API_KEY is not set. Copy .env.example to .env and add your key.")

    for key_label, api_key in keys_to_try:
        print(f"   🔑 Trying {key_label} key")
        result = _try_gemini(api_key, original_image_path,
                             annotated_image_path, abcde_summary,
                             pathology_context, user_prompt, max_retries)
        if result is not None:
            return result
        print(f"   ⚠️  {key_label} key failed, trying next...")

    raise RuntimeError(
        f"Both primary and backup Gemini keys failed.\n"
        "Solutions:\n"
        "  1. Update GEMINI_API_KEY in the .env file with a valid key\n"
        "  2. Wait 24 hours if the daily quota is exhausted\n"
        "  3. Create a new key at https://aistudio.google.com"
    )


def _try_gemini(
    api_key: str,
    original_image_path: str,
    annotated_image_path: str,
    abcde_summary: str,
    pathology_context: str,
    user_prompt: str,
    max_retries: int,
):
    """Try calling Gemini with a specific key. Returns text or None on failure."""
    client = genai.Client(api_key=api_key)

    # Resize images to keep token count low (free tier limit)
    original_img  = resize_for_api(original_image_path,  max_px=768)
    annotated_img = resize_for_api(annotated_image_path, max_px=768)

    full_prompt = f"""
{SYSTEM_PROMPT}

========== PATIENT CLINICAL DESCRIPTION ==========
{user_prompt}

========== QUANTITATIVE ABCDE ANALYSIS (from AI pipeline) ==========
{abcde_summary}

========== PATHOLOGY KNOWLEDGE BASE REFERENCE ==========
{pathology_context}

========== INSTRUCTIONS ==========
The first image is the ORIGINAL skin photo.
The second image is the ANNOTATED version showing detected eczema regions with severity scores.

Analyze both images with the quantitative data and write the full dermatology report
following the exact structure specified in your instructions.
"""

    contents = [original_img, annotated_img, full_prompt]

    for attempt in range(1, max_retries + 1):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=4096,
                ),
            )

            # Safe text extraction — response.text raises ValueError for
            # multi-part responses or safety-blocked responses
            text = None
            try:
                text = response.text
            except ValueError:
                pass

            if not text:
                # Try extracting from candidates directly
                try:
                    parts = response.candidates[0].content.parts
                    text = "".join(
                        p.text for p in parts if hasattr(p, "text") and p.text
                    )
                except (IndexError, AttributeError):
                    pass

            if not text:
                finish = "UNKNOWN"
                try:
                    finish = str(response.candidates[0].finish_reason)
                except Exception:
                    pass
                raise RuntimeError(
                    f"Gemini returned no usable text content. "
                    f"finish_reason={finish}. "
                    f"Candidates: {len(response.candidates) if response.candidates else 0}"
                )

            print(f"   ✅ Gemini responded ({len(text)} characters)")
            return text

        except Exception as e:
            err = str(e)
            print(f"   ❌ Gemini error (attempt {attempt}/{max_retries}): {err}", file=sys.stderr)
            # Rate limit — wait and retry with same key
            if "429" in err or "quota" in err.lower() or "exhausted" in err.lower():
                wait = 60 * attempt
                print(f"   ⏳ Rate limit hit. Waiting {wait}s before retry...")
                time.sleep(wait)
                continue
            # Any other error (invalid key, auth, etc.) — give up on this key
            return None

    # Quota exhausted after all retries — signal failure
    return None


# ══════════════════════════════════════════════
# 3. PDF REPORT BUILDER
# ══════════════════════════════════════════════

def build_pdf_styles() -> dict:
    base = getSampleStyleSheet()
    styles = {}

    styles["title"] = ParagraphStyle(
        "title", parent=base["Normal"],
        fontName="Helvetica-Bold", fontSize=26,
        textColor=colors.white, alignment=TA_CENTER,
        spaceAfter=4, spaceBefore=0,
    )
    styles["subtitle"] = ParagraphStyle(
        "subtitle", parent=base["Normal"],
        fontName="Helvetica", fontSize=12,
        textColor=colors.HexColor("#b8d4ea"),
        alignment=TA_CENTER, spaceAfter=2,
    )
    styles["section"] = ParagraphStyle(
        "section", parent=base["Normal"],
        fontName="Helvetica-Bold", fontSize=14,
        textColor=C_BLUE, spaceBefore=18, spaceAfter=8,
        borderPad=4,
    )
    styles["subsection"] = ParagraphStyle(
        "subsection", parent=base["Normal"],
        fontName="Helvetica-Bold", fontSize=11,
        textColor=C_ACCENT, spaceBefore=10, spaceAfter=4,
    )
    styles["body"] = ParagraphStyle(
        "body", parent=base["Normal"],
        fontName="Helvetica", fontSize=10,
        textColor=C_TEXT, leading=16,
        alignment=TA_JUSTIFY, spaceAfter=6,
    )
    styles["bullet"] = ParagraphStyle(
        "bullet", parent=base["Normal"],
        fontName="Helvetica", fontSize=10,
        textColor=C_TEXT, leading=15,
        leftIndent=16, spaceAfter=3,
        bulletIndent=6,
    )
    styles["highlight"] = ParagraphStyle(
        "highlight", parent=base["Normal"],
        fontName="Helvetica-BoldOblique", fontSize=10,
        textColor=C_GREEN, leading=15,
        spaceAfter=6, spaceBefore=4,
    )
    styles["warning"] = ParagraphStyle(
        "warning", parent=base["Normal"],
        fontName="Helvetica-Bold", fontSize=10,
        textColor=C_RED, leading=15,
        spaceAfter=6,
    )
    styles["caption"] = ParagraphStyle(
        "caption", parent=base["Normal"],
        fontName="Helvetica-Oblique", fontSize=8,
        textColor=C_SUBTLE, alignment=TA_CENTER,
        spaceAfter=8,
    )
    styles["disclaimer"] = ParagraphStyle(
        "disclaimer", parent=base["Normal"],
        fontName="Helvetica-Oblique", fontSize=8.5,
        textColor=C_SUBTLE, leading=13,
        alignment=TA_JUSTIFY, spaceAfter=4,
    )
    styles["metric_label"] = ParagraphStyle(
        "metric_label", parent=base["Normal"],
        fontName="Helvetica-Bold", fontSize=9,
        textColor=C_ACCENT,
    )
    styles["metric_value"] = ParagraphStyle(
        "metric_value", parent=base["Normal"],
        fontName="Helvetica", fontSize=9,
        textColor=C_TEXT,
    )
    return styles


def severity_color(score: float) -> colors.Color:
    if score <= 3:   return C_GREEN
    if score <= 6:   return colors.HexColor("#e67e22")
    if score <= 8:   return colors.HexColor("#e74c3c")
    return colors.HexColor("#8e44ad")


def make_severity_bar(score: float, max_score: float = 10,
                       width: float = 180, height: float = 14) -> Drawing:
    d     = Drawing(width, height)
    bg    = Rect(0, 0, width, height, fillColor=colors.HexColor("#dde8f0"),
                 strokeColor=colors.HexColor("#b0c0d0"), strokeWidth=0.5)
    fill  = Rect(0, 0, width * score / max_score, height,
                 fillColor=severity_color(score), strokeColor=None)
    d.add(bg)
    d.add(fill)
    return d


def make_abcde_table(reports: list, styles: dict) -> Table:
    """Build a clean ABCDE metrics summary table."""
    header = ["Region", "A Asymmetry", "B Border", "C Colors",
              "D Size", "Severity"]
    rows   = [header]
    for r in reports:
        sv = r.get("Severity", {})
        A  = r.get("A_Asymmetry", {})
        B  = r.get("B_Border", {})
        C  = r.get("C_Color", {})
        D  = r.get("D_Diameter", {})
        rows.append([
            f"#{r['region_index']}",
            A.get("label", "-"),
            B.get("label", "-"),
            str(len(C.get("colors_detected", []))) + " variant(s)",
            D.get("label", "-").split("(")[0].strip(),
            f"{sv.get('score','?')}/10",
        ])

    col_widths = [1.2*cm, 3.8*cm, 3.8*cm, 3.0*cm, 3.5*cm, 2.2*cm]
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0), C_BLUE),
        ("TEXTCOLOR",    (0, 0), (-1, 0), colors.white),
        ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, 0), 9),
        ("ALIGN",        (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("FONTNAME",     (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",     (0, 1), (-1, -1), 8.5),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1),
         [colors.HexColor("#eaf4fb"), colors.white]),
        ("GRID",         (0, 0), (-1, -1), 0.4, colors.HexColor("#b0c8e0")),
        ("TOPPADDING",   (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
    ]))
    return t


def parse_report_sections(text: str) -> dict:
    """Parse Gemini output into section dict keyed by header."""
    section_keys = [
        "EXECUTIVE SUMMARY", "PATIENT INFORMATION", "VISUAL ANALYSIS",
        "ABCDE CLINICAL ANALYSIS", "DIAGNOSIS", "DIFFERENTIAL DIAGNOSIS",
        "ECZEMA TYPE & PHASE", "SEVERITY ASSESSMENT",
        "RECOMMENDED TREATMENT PLAN", "LIFESTYLE & PREVENTION ADVICE",
        "WHEN TO SEE A DOCTOR", "FOLLOW-UP SCHEDULE", "MEDICAL DISCLAIMER"
    ]
    sections = {}
    current  = "PREAMBLE"
    buffer   = []

    for line in text.splitlines():
        stripped = line.strip()
        matched  = False
        for key in section_keys:
            if key in stripped.upper():
                if buffer:
                    sections[current] = "\n".join(buffer).strip()
                current = key
                buffer  = []
                matched = True
                break
        if not matched:
            buffer.append(line)

    if buffer:
        sections[current] = "\n".join(buffer).strip()

    return sections


def markdown_to_reportlab(text: str) -> str:
    """Convert Markdown formatting to ReportLab XML tags."""
    # Escape XML special chars first
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    
    # Pattern 1: **bold** (asterisks on both sides)
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    
    # Pattern 2: word:** (label with colon and trailing asterisks - common in Gemini output)
    text = re.sub(r'(\w+):\*\*', r'<b>\1:</b>', text)
    
    # Pattern 3: **word: (asterisks before label with colon)
    text = re.sub(r'\*\*(\w+):', r'<b>\1:</b>', text)
    
    # Convert *italic* to <i>italic</i> (single asterisks, not double)
    text = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<i>\1</i>', text)
    
    return text


def text_to_flowables(text: str, styles: dict) -> list:
    """Convert plain text block into PDF flowables with smart formatting."""
    flowables = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            flowables.append(Spacer(1, 4))
            continue
            
        # Bold headings inside sections (Markdown headers)
        if stripped.startswith("###"):
            content = stripped.lstrip("#").strip()
            content = markdown_to_reportlab(content)
            flowables.append(Paragraph(content, styles["subsection"]))
            
        # Full-line bold (like **Title**)
        elif stripped.startswith("**") and stripped.endswith("**") and stripped.count("**") == 2:
            content = stripped.strip("*")
            content = markdown_to_reportlab(content)
            flowables.append(Paragraph(content, styles["subsection"]))
            
        # Bullet points with Markdown (- item or • item or * item)
        elif stripped.startswith(("- ", "• ", "* ")):
            content = stripped.lstrip("-•* ").strip()
            content = markdown_to_reportlab(content)
            flowables.append(Paragraph(f"&#8226; {content}", styles["bullet"]))
            
        # Numbered lists
        elif re.match(r"^\d+\.", stripped):
            content = re.sub(r"^\d+\.\s*", "", stripped)
            content = markdown_to_reportlab(content)
            flowables.append(Paragraph(f"&#8226; {content}", styles["bullet"]))
            
        # All-caps headers
        elif stripped.upper() == stripped and len(stripped) > 4 and not any(c in stripped for c in "**_"):
            content = markdown_to_reportlab(stripped)
            flowables.append(Paragraph(content, styles["subsection"]))
            
        # Warning text
        elif "⚠" in stripped or "urgent" in stripped.lower() or "immediately" in stripped.lower():
            content = markdown_to_reportlab(stripped)
            flowables.append(Paragraph(content, styles["warning"]))
            
        # Highlight text
        elif stripped.startswith("What this means"):
            content = markdown_to_reportlab(stripped)
            flowables.append(Paragraph(content, styles["highlight"]))
            
        # Regular paragraph — convert Markdown inline formatting
        else:
            content = markdown_to_reportlab(stripped)
            flowables.append(Paragraph(content, styles["body"]))

    return flowables


def add_cover_page(story: list, styles: dict, reports: list,
                   run_date: str):
    """Build a professionally styled cover page."""
    
    # ═══════════════════════════════════════════════════════
    # MAIN TITLE BANNER - Dark blue background
    # ═══════════════════════════════════════════════════════
    title_table = Table([
        [Paragraph("DERMATOLOGY", ParagraphStyle(
            "t1", fontName="Helvetica-Bold", fontSize=32,
            textColor=colors.white, alignment=TA_CENTER,
            spaceBefore=0, spaceAfter=0))],
        [Paragraph("ANALYSIS REPORT", ParagraphStyle(
            "t2", fontName="Helvetica-Bold", fontSize=32,
            textColor=colors.white, alignment=TA_CENTER,
            spaceBefore=4, spaceAfter=0))],
    ], colWidths=[17*cm])
    
    title_table.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), C_DARK),
        ("TOPPADDING",   (0, 0), (-1, -1), 24),
        ("BOTTOMPADDING",(0, 1), (-1, -1), 20),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(title_table)
    
    # Subtitle banner - lighter blue
    subtitle_table = Table([
        [Paragraph("Eczema Detection &amp; Assessment System", ParagraphStyle(
            "st", fontName="Helvetica", fontSize=13,
            textColor=colors.white, alignment=TA_CENTER))],
    ], colWidths=[17*cm])
    
    subtitle_table.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), C_BLUE),
        ("TOPPADDING",   (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 10),
    ]))
    story.append(subtitle_table)
    
    # Date line
    date_table = Table([
        [Paragraph(f"Generated: {run_date}", ParagraphStyle(
            "dt", fontName="Helvetica", fontSize=10,
            textColor=C_SUBTLE, alignment=TA_CENTER))],
    ], colWidths=[17*cm])
    
    date_table.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), C_LIGHT),
        ("TOPPADDING",   (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
    ]))
    story.append(date_table)
    story.append(Spacer(1, 28))

    # ═══════════════════════════════════════════════════════
    # SEVERITY CARDS
    # ═══════════════════════════════════════════════════════
    for r in reports:
        sv    = r.get("Severity", {})
        score = sv.get("score", 0)
        sev   = sv.get("severity", "N/A")
        bg_col = severity_color(score)
        
        card = Table([[
            Paragraph(f"Region {r['region_index']}", ParagraphStyle(
                "ch", fontName="Helvetica-Bold", fontSize=12,
                textColor=colors.white, alignment=TA_CENTER)),
            Paragraph(f"{score}/10", ParagraphStyle(
                "cv", fontName="Helvetica-Bold", fontSize=22,
                textColor=colors.white, alignment=TA_CENTER)),
            Paragraph(sev, ParagraphStyle(
                "cs", fontName="Helvetica", fontSize=10,
                textColor=colors.HexColor("#f0f0f0"), alignment=TA_CENTER)),
        ]], colWidths=[4.5*cm, 5.5*cm, 7*cm])
        
        card.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1, -1), bg_col),
            ("TOPPADDING",   (0, 0), (-1, -1), 14),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 14),
            ("ALIGN",        (0, 0), (-1, -1), "CENTER"),
            ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
            ("ROUNDEDCORNERS", [4, 4, 4, 4]),
        ]))
        story.append(card)
        story.append(Spacer(1, 8))

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=2,
                            color=C_ACCENT, spaceAfter=14))

    # ═══════════════════════════════════════════════════════
    # PIPELINE INFORMATION TABLE
    # ═══════════════════════════════════════════════════════
    pipeline_info = Table([
        [Paragraph("Pipeline", ParagraphStyle("pl", fontName="Helvetica-Bold",
                   fontSize=9, textColor=C_ACCENT)),
         Paragraph("Eczema Detection System (Pillar 1 + 2 + 3)", ParagraphStyle(
                   "pv", fontName="Helvetica", fontSize=9, textColor=C_TEXT))],
        [Paragraph("AI Model", ParagraphStyle("al", fontName="Helvetica-Bold",
                   fontSize=9, textColor=C_ACCENT)),
         Paragraph(f"Google Gemini 3.0 Flash (VLM)", ParagraphStyle(
                   "av", fontName="Helvetica", fontSize=9, textColor=C_TEXT))],
        [Paragraph("Analysis Method", ParagraphStyle("ml", fontName="Helvetica-Bold",
                   fontSize=9, textColor=C_ACCENT)),
         Paragraph("YOLOv8 Detection + ABCDE Image Processing + VLM Medical Reasoning", ParagraphStyle(
                   "mv", fontName="Helvetica", fontSize=9, textColor=C_TEXT))],
        [Paragraph("Regions Detected", ParagraphStyle("rl", fontName="Helvetica-Bold",
                   fontSize=9, textColor=C_ACCENT)),
         Paragraph(str(len(reports)), ParagraphStyle(
                   "rv", fontName="Helvetica", fontSize=9, textColor=C_TEXT))],
    ], colWidths=[4*cm, 13*cm])
    pipeline_info.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), C_GRAY),
        ("TOPPADDING",   (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("GRID",         (0, 0), (-1, -1), 0.3, colors.HexColor("#d0d8e0")),
    ]))
    story.append(pipeline_info)
    story.append(PageBreak())


def section_header(title: str, styles: dict) -> list:
    """Return a styled section header with accent bar."""
    return [
        HRFlowable(width="100%", thickness=3, color=C_ACCENT,
                   spaceBefore=8, spaceAfter=0),
        Paragraph(title, styles["section"]),
    ]


def build_pdf_report(
    gemini_text: str,
    reports: list,
    original_image_path: str,
    annotated_image_path: str,
    output_path: Path,
    run_date: str,
) -> Path:
    print("\n[📄] Building PDF report...")

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=1.8*cm, rightMargin=1.8*cm,
        topMargin=1.6*cm, bottomMargin=1.8*cm,
        title="Dermatology Eczema Report",
        author="Eczema AI Pipeline",
    )

    styles  = build_pdf_styles()
    story   = []
    sections = parse_report_sections(gemini_text)

    # ── Cover page
    add_cover_page(story, styles, reports, run_date)

    # ── Image panel
    story += section_header("VISUAL ANALYSIS — IMAGE REVIEW", styles)
    story.append(Spacer(1, 8))

    try:
        img_w = 8.0 * cm
        img_h = 6.5 * cm
        img_table = Table(
            [[RLImage(original_image_path, width=img_w, height=img_h),
              RLImage(annotated_image_path, width=img_w, height=img_h)]],
            colWidths=[8.5*cm, 8.5*cm]
        )
        img_table.setStyle(TableStyle([
            ("ALIGN",        (0, 0), (-1, -1), "CENTER"),
            ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",   (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ]))
        story.append(img_table)

        caption_table = Table(
            [[Paragraph("Original Image", styles["caption"]),
              Paragraph("Annotated — YOLO + ABCDE Regions", styles["caption"])]],
            colWidths=[8.5*cm, 8.5*cm]
        )
        story.append(caption_table)
    except Exception as e:
        story.append(Paragraph(f"[Images could not be embedded: {e}]",
                               styles["body"]))

    story.append(Spacer(1, 10))

    # Visual Analysis from Gemini
    if "VISUAL ANALYSIS" in sections:
        story += text_to_flowables(sections["VISUAL ANALYSIS"], styles)

    # ── ABCDE metrics table
    story += section_header("ABCDE QUANTITATIVE METRICS SUMMARY", styles)
    story.append(Spacer(1, 6))
    story.append(make_abcde_table(reports, styles))
    story.append(Spacer(1, 6))

    # Severity bars
    for r in reports:
        sv    = r.get("Severity", {})
        score = sv.get("score", 0)
        row   = Table([
            [Paragraph(f"Region {r['region_index']} Severity:",
                       styles["metric_label"]),
             make_severity_bar(score),
             Paragraph(f"{score}/10  {sv.get('severity','')}",
                       styles["metric_value"])]
        ], colWidths=[3.5*cm, 5.5*cm, 8*cm])
        row.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(row)
    story.append(Spacer(1, 8))

    # ── Main report sections from Gemini
    ordered_sections = [
        ("EXECUTIVE SUMMARY",           "EXECUTIVE SUMMARY"),
        ("PATIENT INFORMATION",         "PATIENT INFORMATION"),
        ("ABCDE CLINICAL ANALYSIS",     "ABCDE CLINICAL ANALYSIS"),
        ("DIAGNOSIS",                   "DIAGNOSIS"),
        ("DIFFERENTIAL DIAGNOSIS",      "DIFFERENTIAL DIAGNOSIS"),
        ("ECZEMA TYPE & PHASE",         "ECZEMA TYPE & PHASE"),
        ("SEVERITY ASSESSMENT",         "SEVERITY ASSESSMENT"),
        ("RECOMMENDED TREATMENT PLAN",  "RECOMMENDED TREATMENT PLAN"),
        ("LIFESTYLE & PREVENTION ADVICE","LIFESTYLE & PREVENTION ADVICE"),
        ("WHEN TO SEE A DOCTOR",        "WHEN TO SEE A DOCTOR"),
        ("FOLLOW-UP SCHEDULE",          "FOLLOW-UP SCHEDULE"),
        ("MEDICAL DISCLAIMER",          "MEDICAL DISCLAIMER"),
    ]

    for section_key, display_name in ordered_sections:
        if section_key in sections and sections[section_key].strip():
            story += section_header(display_name, styles)
            story += text_to_flowables(sections[section_key], styles)
            story.append(Spacer(1, 4))

    # ── Footer note
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=1,
                             color=C_SUBTLE, spaceAfter=6))
    story.append(Paragraph(
        f"Report generated by Eczema AI System — Pillar 3 | {run_date} | "
        "Powered by Google Gemini 3.0 Flash + YOLOv8 + OpenCV",
        styles["disclaimer"]
    ))
    story.append(Paragraph(
        "This report is for informational purposes only and does not constitute "
        "a medical diagnosis. Always consult a qualified dermatologist for proper "
        "evaluation and treatment.",
        styles["disclaimer"]
    ))

    doc.build(story)
    print(f"   ✅ PDF saved → {output_path}")
    return output_path


# ══════════════════════════════════════════════
# 4. MAIN PIPELINE
# ══════════════════════════════════════════════

def run_pillar3(
    json_path: str,
    original_image_path: str,
    annotated_image_path: str,
    pathology_excel_path: str,
    user_prompt: str,
):
    print("\n" + "=" * 60)
    print("  PILLAR 3 — VLM DERMATOLOGY REPORT GENERATOR")
    print("=" * 60)

    run_date = datetime.now().strftime("%Y-%m-%d %H:%M")
    run_id   = datetime.now().strftime("%Y%m%d_%H%M%S")

    # ── Load inputs
    print("\n[1/4] 📂 Loading inputs...")
    reports          = load_abcde_json(json_path)
    pathology_context = load_pathology_excel(pathology_excel_path)
    abcde_summary    = build_abcde_summary(reports)
    print(f"   ✅ {len(reports)} region(s) from ABCDE JSON")
    print(f"   ✅ Pathology KB loaded ({len(pathology_context.splitlines())} entries)")

    # ── Call Gemini
    print("\n[2/4] 🤖 Calling Gemini 3.0 Flash VLM...")
    gemini_text = call_gemini(
        original_image_path=original_image_path,
        annotated_image_path=annotated_image_path,
        abcde_summary=abcde_summary,
        pathology_context=pathology_context,
        user_prompt=user_prompt,
    )

    # Save raw Gemini output for debugging
    raw_path = OUTPUT_DIR / f"raw_gemini_{run_id}.txt"
    with open(raw_path, "w", encoding="utf-8") as f:
        f.write(gemini_text)
    print(f"   💾 Raw output saved → {raw_path}")

    # ── Build PDF
    print("\n[3/4] 📄 Generating PDF report...")
    pdf_path = OUTPUT_DIR / f"dermatology_report_{run_id}.pdf"
    build_pdf_report(
        gemini_text=gemini_text,
        reports=reports,
        original_image_path=original_image_path,
        annotated_image_path=annotated_image_path,
        output_path=pdf_path,
        run_date=run_date,
    )

    # ── Done
    print("\n" + "=" * 60)
    print("  ✅ PILLAR 3 COMPLETE")
    print("=" * 60)
    print(f"\n  📄 PDF Report  : {pdf_path}")
    print(f"  📝 Raw text    : {raw_path}")
    print(f"\n  Regions analysed : {len(reports)}")
    for r in reports:
        sv = r.get("Severity", {})
        print(f"  Region #{r['region_index']} → {sv.get('score','?')}/10 ({sv.get('severity','?')})")

    return pdf_path


# ══════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Pillar 3 — VLM Dermatology Report Generator"
    )
    parser.add_argument("--json",       required=True,
        help="Path to abcde_report.json from Pillar 2")
    parser.add_argument("--original",   required=True,
        help="Path to original input image")
    parser.add_argument("--annotated",  required=True,
        help="Path to final_annotated.jpg from Pillar 2")
    parser.add_argument("--pathology",  required=True,
        help="Path to pathology.xlsx knowledge base")
    parser.add_argument("--prompt",     required=True,
        help="Patient/user clinical description (in quotes)")
    args = parser.parse_args()

    run_pillar3(
        json_path             = args.json,
        original_image_path   = args.original,
        annotated_image_path  = args.annotated,
        pathology_excel_path  = args.pathology,
        user_prompt           = args.prompt,
    )
