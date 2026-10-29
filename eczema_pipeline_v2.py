"""
================================================================
  PILLAR 2 v2 — ECZEMA IMAGE PROCESSING PIPELINE (ABCDE)
  Fixes:
    - Diameter computed on real pixel size (not 256x256)
    - Redness mask uses adaptive skin-aware thresholding
    - Asymmetry uses lesion-only bounding box, not full mask
  New:
    - E — Evolution: multi-metric change score between runs
    - Improved segmentation: LAB k-means lesion isolation
    - Otsu + adaptive thresholding fallback chain
    - Lesion severity score (0-10 scale)
    - Improved ABCDE report card with score bars
================================================================
"""

import sys
import cv2
import numpy as np
import os
import json
import argparse
from pathlib import Path
from datetime import datetime
from ultralytics import YOLO
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
from skimage.feature import graycomatrix, graycoprops
import warnings
warnings.filterwarnings("ignore")

# ──────────────────────────────────────────────
# 0. CONFIG
# ──────────────────────────────────────────────
OUTPUT_DIR  = Path("output")
HISTORY_DIR = Path("history")   # stores previous runs for E — Evolution
OUTPUT_DIR.mkdir(exist_ok=True)
HISTORY_DIR.mkdir(exist_ok=True)

TARGET_SIZE = (256, 256)   # internal processing resolution


# ══════════════════════════════════════════════
# 1. YOLO DETECTION
# ══════════════════════════════════════════════
def run_yolo_detection(model_path: str, image_path: str, conf: float = 0.25):
    print(f"\n[1/7] 🔍 Running YOLOv8 detection...")
    model  = YOLO(model_path)
    result = model.predict(source=image_path, conf=conf, save=False)[0]
    img    = cv2.imread(image_path)
    boxes  = []
    for box in result.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
        boxes.append({
            "x1": x1, "y1": y1, "x2": x2, "y2": y2,
            "conf": round(float(box.conf[0]), 3),
            "w_px": x2 - x1, "h_px": y2 - y1
        })
    print(f"   ✅ Detected {len(boxes)} eczema region(s).")
    return img, boxes


# ══════════════════════════════════════════════
# 2. IMPROVED SEGMENTATION
# ══════════════════════════════════════════════

def build_lesion_mask(roi_bgr: np.ndarray) -> np.ndarray:
    """
    Multi-stage adaptive lesion mask — fixes the over-detection problem.

    Strategy:
      1. Detect dominant skin tone from the ROI itself (adaptive)
      2. Build redness deviation map relative to skin tone
      3. K-Means clustering in LAB space to separate lesion vs normal skin
      4. Combine redness deviation + K-Means with Otsu thresholding
      5. Clean up with morphology
    """
    roi = cv2.resize(roi_bgr, TARGET_SIZE)
    lab = cv2.cvtColor(roi, cv2.COLOR_BGR2LAB).astype(np.float32)
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV).astype(np.float32)

    # ── Step 1: Estimate skin background tone
    # Sample the image border (likely to be healthy skin near lesion)
    border_pixels = _sample_border(lab, margin=20)
    if len(border_pixels) > 10:
        skin_a = np.median(border_pixels[:, 1])   # a* channel (green-red axis)
        skin_b = np.median(border_pixels[:, 2])   # b* channel (blue-yellow axis)
        skin_l = np.median(border_pixels[:, 0])
    else:
        skin_a, skin_b, skin_l = 135.0, 135.0, 170.0   # fallback neutral

    # ── Step 2: Redness deviation map (how much redder than background skin)
    a_ch = lab[:, :, 1]
    b_ch = lab[:, :, 2]
    l_ch = lab[:, :, 0]
    # Distance in a*b* space from skin tone
    redness_dev = np.sqrt((a_ch - skin_a) ** 2 + (b_ch - skin_b) ** 2)
    redness_dev = cv2.normalize(redness_dev, None, 0, 255,
                                cv2.NORM_MINMAX).astype(np.uint8)

    # ── Step 3: Adaptive threshold on redness deviation
    _, otsu_mask = cv2.threshold(redness_dev, 0, 255,
                                 cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # ── Step 4: K-Means in LAB space (k=3: healthy, lesion, crust/dark)
    pixels = lab.reshape(-1, 3)
    pixels_f32 = pixels.astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 0.5)
    _, labels, centers = cv2.kmeans(pixels_f32, 3, None, criteria, 5,
                                    cv2.KMEANS_PP_CENTERS)
    labels_img = labels.reshape(TARGET_SIZE)

    # Find which cluster(s) deviate most from skin tone in a* channel
    cluster_a = centers[:, 1]
    # Lesion = highest a* (reddest) or lowest L* (darkest) relative to skin
    lesion_cluster = int(np.argmax(
        np.abs(cluster_a - skin_a) + np.abs(centers[:, 0] - skin_l) * 0.3
    ))
    kmeans_mask = ((labels_img == lesion_cluster).astype(np.uint8) * 255)

    # ── Step 5: Combine both masks (union → then filter by L* to exclude
    #    very bright specular highlights which are white scale)
    combined = cv2.bitwise_or(otsu_mask, kmeans_mask)

    # Exclude very bright patches (specular / shine) unless they're white scale
    # White scale has high L* but also elevated a* — keep those
    is_bright   = (l_ch > 230).astype(np.uint8) * 255
    is_red_hue  = (a_ch > skin_a + 5).astype(np.uint8) * 255
    false_bright = cv2.bitwise_and(is_bright,
                                   cv2.bitwise_not(is_red_hue))
    combined = cv2.bitwise_and(combined, cv2.bitwise_not(false_bright))

    # ── Step 6: Morphological clean-up
    k5 = np.ones((5, 5), np.uint8)
    k3 = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, k5)
    mask = cv2.morphologyEx(mask,    cv2.MORPH_OPEN,  k3)

    # Keep only the largest connected component if it covers ≥10% of area
    mask = _keep_largest_components(mask, min_fraction=0.05)

    return mask   # 256×256 binary uint8


def _sample_border(lab: np.ndarray, margin: int = 20) -> np.ndarray:
    """Return pixels from image border as background skin sample."""
    h, w = lab.shape[:2]
    top    = lab[:margin, :].reshape(-1, 3)
    bottom = lab[h-margin:, :].reshape(-1, 3)
    left   = lab[:, :margin].reshape(-1, 3)
    right  = lab[:, w-margin:].reshape(-1, 3)
    return np.vstack([top, bottom, left, right])


def _keep_largest_components(mask: np.ndarray,
                              min_fraction: float = 0.05) -> np.ndarray:
    """Remove tiny noise blobs; keep components ≥ min_fraction of total."""
    num, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
    total = mask.shape[0] * mask.shape[1]
    out   = np.zeros_like(mask)
    for i in range(1, num):
        if stats[i, cv2.CC_STAT_AREA] >= total * min_fraction:
            out[labels == i] = 255
    return out


def apply_preprocessing(roi_bgr: np.ndarray) -> dict:
    """Full image processing toolbox on a single ROI crop."""
    res = {}
    res["original"] = roi_bgr.copy()
    roi = cv2.resize(roi_bgr, TARGET_SIZE)

    # ── Grayscale
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    res["grayscale"] = gray

    # ── Gaussian blur
    blurred = cv2.GaussianBlur(roi, (5, 5), 0)
    res["blurred"] = blurred

    # ── CLAHE on LAB L-channel
    lab   = cv2.cvtColor(blurred, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    cl    = clahe.apply(l)
    clahe_img = cv2.cvtColor(cv2.merge((cl, a, b)), cv2.COLOR_LAB2BGR)
    res["clahe_enhanced"] = clahe_img

    # ── HSV
    res["hsv"] = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    # ── Improved adaptive lesion mask
    lesion_mask = build_lesion_mask(roi_bgr)
    res["lesion_mask"] = lesion_mask          # replaces old redness_mask

    # ── Erythema index (R/G ratio)
    b_ch, g_ch, r_ch = cv2.split(roi.astype(np.float32))
    erythema = r_ch / (g_ch + 1e-6)
    erythema_norm = cv2.normalize(erythema, None, 0, 255,
                                  cv2.NORM_MINMAX).astype(np.uint8)
    res["erythema_map"] = cv2.applyColorMap(erythema_norm, cv2.COLORMAP_HOT)

    # ── Canny edges
    res["edges"] = cv2.Canny(gray, 50, 150)

    # ── Morphology mask (already in lesion_mask — keep alias for grid)
    res["morphology_mask"] = lesion_mask

    # ── GrabCut
    res["grabcut"] = _apply_grabcut(roi)

    # ── Watershed
    res["watershed"] = _apply_watershed(clahe_img)

    # ── Segmentation overlay (improved: teal outline + red fill blend)
    overlay  = roi.copy()
    contours, _ = cv2.findContours(lesion_mask, cv2.RETR_EXTERNAL,
                                   cv2.CHAIN_APPROX_SIMPLE)
    fill_mask = np.zeros_like(roi)
    cv2.drawContours(fill_mask, contours, -1, (0, 60, 220), -1)
    blended  = cv2.addWeighted(roi, 0.65, fill_mask, 0.35, 0)
    cv2.drawContours(blended, contours, -1, (0, 230, 180), 2)
    res["segmentation_overlay"] = blended

    return res


def _apply_grabcut(roi_bgr: np.ndarray) -> np.ndarray:
    try:
        mask = np.zeros(roi_bgr.shape[:2], np.uint8)
        h, w = roi_bgr.shape[:2]
        m    = max(5, min(15, h // 10, w // 10))
        rect = (m, m, w - 2 * m, h - 2 * m)
        bgm  = np.zeros((1, 65), np.float64)
        fgm  = np.zeros((1, 65), np.float64)
        cv2.grabCut(roi_bgr, mask, rect, bgm, fgm, 5, cv2.GC_INIT_WITH_RECT)
        fg = np.where((mask == 2) | (mask == 0), 0, 1).astype("uint8")
        return roi_bgr * fg[:, :, np.newaxis]
    except Exception:
        return roi_bgr.copy()


def _apply_watershed(roi_bgr: np.ndarray) -> np.ndarray:
    try:
        gray = cv2.cvtColor(roi_bgr, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 0, 255,
                                  cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        k3       = np.ones((3, 3), np.uint8)
        sure_bg  = cv2.dilate(thresh, k3, iterations=3)
        dist     = cv2.distanceTransform(thresh, cv2.DIST_L2, 5)
        _, sure_fg = cv2.threshold(dist, 0.4 * dist.max(), 255, 0)
        sure_fg  = np.uint8(sure_fg)
        unknown  = cv2.subtract(sure_bg, sure_fg)
        _, markers = cv2.connectedComponents(sure_fg)
        markers  += 1
        markers[unknown == 255] = 0
        markers  = cv2.watershed(roi_bgr, markers)
        result   = roi_bgr.copy()
        result[markers == -1] = [0, 230, 120]
        return result
    except Exception:
        return roi_bgr.copy()


# ══════════════════════════════════════════════
# 3. ABCDE FEATURE EXTRACTION
# ══════════════════════════════════════════════

def compute_asymmetry(mask: np.ndarray) -> dict:
    """
    A — Asymmetry
    Operates on the BOUNDING BOX of the lesion, not the full 256×256 square.
    This avoids the all-symmetric bias when the mask fills the image.
    """
    # Find tight bounding box around lesion pixels
    coords = np.argwhere(mask > 0)
    if len(coords) < 50:
        return {"horizontal_asymmetry": 0.0, "vertical_asymmetry": 0.0,
                "score": 0, "label": "Symmetric (insufficient lesion area)"}

    r0, c0 = coords.min(axis=0)
    r1, c1 = coords.max(axis=0)
    cropped = mask[r0:r1+1, c0:c1+1]

    h, w = cropped.shape
    # Horizontal axis
    left  = cropped[:, :w//2]
    right = np.fliplr(cropped[:, w//2:])
    mw    = min(left.shape[1], right.shape[1])
    h_diff = np.sum(np.abs(left[:, :mw].astype(int) -
                            right[:, :mw].astype(int)))
    total  = np.sum(cropped) + 1e-6
    asym_h = h_diff / total

    # Vertical axis
    top    = cropped[:h//2, :]
    bottom = np.flipud(cropped[h//2:, :])
    mh     = min(top.shape[0], bottom.shape[0])
    v_diff = np.sum(np.abs(top[:mh, :].astype(int) -
                            bottom[:mh, :].astype(int)))
    asym_v = v_diff / total

    score = int(asym_h > 0.25) + int(asym_v > 0.25)
    labels = ["Symmetric", "Slightly asymmetric", "Highly asymmetric"]
    return {
        "horizontal_asymmetry": round(float(asym_h), 3),
        "vertical_asymmetry":   round(float(asym_v), 3),
        "score": score,
        "label": labels[score]
    }


def compute_border(mask: np.ndarray) -> dict:
    """
    B — Border irregularity
    Uses circularity, convexity ratio, and fractal-like perimeter complexity.
    """
    cnts, _ = cv2.findContours(mask.astype(np.uint8),
                                cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return {"circularity": 1.0, "convexity": 1.0,
                "irregularity_defects": 0, "score": 0, "label": "Smooth border"}

    cnt  = max(cnts, key=cv2.contourArea)
    area = cv2.contourArea(cnt)
    peri = cv2.arcLength(cnt, True)

    circularity = (4 * np.pi * area) / (peri ** 2 + 1e-6)
    circularity  = min(circularity, 1.0)

    # Convexity ratio
    hull    = cv2.convexHull(cnt)
    hull_a  = cv2.contourArea(hull)
    convexity = area / (hull_a + 1e-6)

    # Count significant convexity defects
    defect_count = 0
    try:
        hull_idx = cv2.convexHull(cnt, returnPoints=False)
        defects  = cv2.convexityDefects(cnt, hull_idx)
        if defects is not None:
            defect_count = int(np.sum(
                defects[:, 0, 3] / 256.0 > 8   # depth > 8px
            ))
    except Exception:
        pass

    # Score: 0=smooth, 1=slightly, 2=moderately, 3=highly irregular
    score = 0
    if circularity < 0.75: score += 1
    if circularity < 0.45: score += 1
    if convexity   < 0.75: score += 1
    score = min(score, 3)

    label_map = {0: "Smooth border", 1: "Slightly irregular",
                 2: "Moderately irregular", 3: "Highly irregular"}
    return {
        "circularity":          round(float(circularity), 3),
        "convexity_ratio":      round(float(convexity),   3),
        "irregularity_defects": defect_count,
        "score": score,
        "label": label_map[score]
    }


def compute_color(roi_bgr: np.ndarray, mask: np.ndarray) -> dict:
    """
    C — Color variation
    Detects multiple clinically relevant color zones.
    Uses skin-adaptive thresholds instead of fixed HSV ranges.
    """
    roi_256  = cv2.resize(roi_bgr, TARGET_SIZE)
    hsv_256  = cv2.cvtColor(roi_256, cv2.COLOR_BGR2HSV)
    lab_256  = cv2.cvtColor(roi_256, cv2.COLOR_BGR2LAB)

    # Work only on lesion pixels
    pix_bgr = roi_256[mask > 0].astype(np.float32)
    pix_hsv = hsv_256[mask > 0].astype(np.float32)
    pix_lab = lab_256[mask > 0].astype(np.float32)

    if len(pix_bgr) < 20:
        return {"colors_detected": ["Insufficient data"], "score": 1,
                "color_variation_std": 0.0, "label": "1 color variant(s): Insufficient data"}

    # Skin-adaptive: compute median skin tone from lesion pixels
    median_a = float(np.median(pix_lab[:, 1]))
    median_l = float(np.median(pix_lab[:, 0]))

    colors = []

    # Red / Inflamed — elevated a* (LAB) relative to median
    red_frac = float(np.mean(pix_lab[:, 1] > median_a + 8))
    if red_frac > 0.15:
        colors.append("Red/Inflamed")

    # Brown / Dark — low L* and moderate a*
    dark_frac = float(np.mean((pix_lab[:, 0] < median_l - 20) &
                               (pix_lab[:, 1] > 120)))
    if dark_frac > 0.08:
        colors.append("Brown/Dark")

    # White / Scaling — very high L* (bright patches)
    white_frac = float(np.mean(pix_lab[:, 0] > 210))
    if white_frac > 0.04:
        colors.append("White/Scaling")

    # Pink / Mild erythema — slightly elevated a*, normal L*
    if "Red/Inflamed" not in colors:
        pink_frac = float(np.mean((pix_lab[:, 1] > median_a + 3) &
                                   (pix_lab[:, 0] > median_l - 10)))
        if pink_frac > 0.20:
            colors.append("Pink/Mild erythema")

    # Yellow-brown crust — elevated b* (LAB)
    crust_frac = float(np.mean(pix_lab[:, 2] > 145))
    if crust_frac > 0.08:
        colors.append("Yellow/Crust")

    if not colors:
        colors.append("Skin-tone (minimal deviation)")

    color_var = float(np.std(pix_lab[:, 0]))
    score = len(colors)
    label = f"{score} color variant(s): {', '.join(colors)}"

    return {
        "colors_detected":     colors,
        "color_variation_std": round(color_var, 2),
        "red_fraction":        round(red_frac,  3),
        "dark_fraction":       round(dark_frac, 3),
        "white_fraction":      round(white_frac,3),
        "score": score,
        "label": label
    }


def compute_diameter(mask: np.ndarray, original_roi_shape: tuple,
                     original_box: dict) -> dict:
    """
    D — Diameter / Size
    FIX: compute diameter from the ORIGINAL box pixel dimensions,
    not from the 256×256 resized mask. This gives real sizes.
    """
    # Real lesion bounding box size
    real_w = original_box["w_px"]
    real_h = original_box["h_px"]
    real_area = real_w * real_h   # bounding box area in px²

    # Lesion fill ratio from mask
    fill_ratio = float(np.sum(mask > 0)) / (TARGET_SIZE[0] * TARGET_SIZE[1])

    # Estimated lesion area in real pixels
    est_lesion_area = real_area * fill_ratio

    # Equivalent circle diameter from area
    est_diameter = float(np.sqrt(4 * est_lesion_area / np.pi))

    # Minimum enclosing circle on the mask contour (for shape)
    cnts, _ = cv2.findContours(mask.astype(np.uint8),
                                cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if cnts:
        cnt = max(cnts, key=cv2.contourArea)
        _, radius = cv2.minEnclosingCircle(cnt)
        # Scale radius to real image space
        scale = max(real_w, real_h) / max(TARGET_SIZE)
        real_radius = float(radius) * scale
        est_diameter = real_radius * 2.0

    # Classify
    if est_diameter < 50:
        size_label = "Small lesion (< 50 px)"
    elif est_diameter < 150:
        size_label = "Medium lesion (50-150 px)"
    elif est_diameter < 300:
        size_label = "Large lesion (150-300 px)"
    else:
        size_label = "Extensive lesion (> 300 px)"

    return {
        "estimated_diameter_px": round(est_diameter, 1),
        "bounding_box_px":       f"{real_w}×{real_h}",
        "fill_ratio":            round(fill_ratio, 3),
        "score": size_label,
        "label": size_label
    }


def compute_texture(gray_roi: np.ndarray, mask: np.ndarray) -> dict:
    """
    Texture (bonus): GLCM + Local Binary Pattern variance.
    """
    try:
        # GLCM on masked region
        roi_m = gray_roi.copy()
        roi_m[mask == 0] = 0
        small = cv2.resize(roi_m, (64, 64))
        glcm  = graycomatrix(small, distances=[1], angles=[0, np.pi/4],
                             levels=256, symmetric=True, normed=True)
        contrast    = float(graycoprops(glcm, "contrast")[0].mean())
        homogeneity = float(graycoprops(glcm, "homogeneity")[0].mean())
        energy      = float(graycoprops(glcm, "energy")[0].mean())

        # Local standard deviation (roughness map)
        kernel    = np.ones((7, 7), np.float32) / 49
        mean_map  = cv2.filter2D(gray_roi.astype(np.float32), -1, kernel)
        sq_map    = cv2.filter2D(gray_roi.astype(np.float32) ** 2, -1, kernel)
        std_map   = np.sqrt(np.maximum(sq_map - mean_map ** 2, 0))
        roughness = float(np.mean(std_map[mask > 0])) if np.any(mask > 0) else 0.0

        label = "Rough/thickened skin" if contrast > 200 or roughness > 15 \
                else "Moderately textured" if contrast > 80 \
                else "Relatively smooth surface"

        return {
            "glcm_contrast":    round(contrast,    2),
            "glcm_homogeneity": round(homogeneity, 4),
            "glcm_energy":      round(energy,      4),
            "roughness_index":  round(roughness,   2),
            "label": label
        }
    except Exception:
        return {"label": "Texture analysis unavailable",
                "glcm_contrast": 0, "roughness_index": 0}


def compute_evolution(current_report: dict, history_path: Path,
                      region_idx: int) -> dict:
    """
    E — Evolution
    Compares current ABCDE metrics against the previous run stored in history.
    If no history exists, flags as 'First observation — baseline recorded'.

    Metrics tracked:
      • Lesion diameter change (%)
      • Color score change
      • Border score change
      • Asymmetry score change
      • Texture roughness change
      • Fill ratio change (lesion coverage)
    """
    history_file = history_path / f"region_{region_idx + 1}_history.json"

    # Build current snapshot
    snapshot = {
        "timestamp":   datetime.now().isoformat(),
        "diameter_px": current_report["D_Diameter"]["estimated_diameter_px"],
        "fill_ratio":  current_report["D_Diameter"]["fill_ratio"],
        "color_score": current_report["C_Color"]["score"],
        "border_score":current_report["B_Border"]["score"],
        "asym_score":  current_report["A_Asymmetry"]["score"],
        "roughness":   current_report["Texture_Bonus"].get("roughness_index", 0),
        "color_var":   current_report["C_Color"]["color_variation_std"],
    }

    if not history_file.exists():
        # No prior data — save baseline
        with open(history_file, "w") as f:
            json.dump([snapshot], f, indent=2)
        return {
            "status": "First observation",
            "message": "Baseline recorded. Run again after treatment to track evolution.",
            "changes": {},
            "evolution_score": 0,
            "label": "First observation — baseline established"
        }

    # Load history
    with open(history_file) as f:
        history = json.load(f)
    prev = history[-1]

    # Compute changes
    changes = {}

    # Diameter change
    d_prev = prev["diameter_px"]
    d_curr = snapshot["diameter_px"]
    if d_prev > 0:
        d_change_pct = ((d_curr - d_prev) / d_prev) * 100
        changes["diameter_change_pct"] = round(d_change_pct, 1)
        changes["diameter_trend"] = (
            "⬆️ Increased" if d_change_pct > 10
            else "⬇️ Decreased" if d_change_pct < -10
            else "➡️ Stable"
        )

    # Fill ratio
    fr_prev = prev["fill_ratio"]
    fr_curr = snapshot["fill_ratio"]
    fr_change = fr_curr - fr_prev
    changes["fill_ratio_change"] = round(float(fr_change), 3)
    changes["spread_trend"] = (
        "⬆️ Spreading" if fr_change > 0.05
        else "⬇️ Receding" if fr_change < -0.05
        else "➡️ Stable coverage"
    )

    # Color complexity
    cs_delta = snapshot["color_score"] - prev["color_score"]
    changes["color_score_change"] = int(cs_delta)
    changes["color_trend"] = (
        "⬆️ More color variants (worsening)" if cs_delta > 0
        else "⬇️ Fewer color variants (improving)" if cs_delta < 0
        else "➡️ Same color complexity"
    )

    # Border regularity
    bs_delta = snapshot["border_score"] - prev["border_score"]
    changes["border_score_change"] = int(bs_delta)
    changes["border_trend"] = (
        "⬆️ More irregular (worsening)" if bs_delta > 0
        else "⬇️ More regular (improving)" if bs_delta < 0
        else "➡️ Border unchanged"
    )

    # Asymmetry
    as_delta = snapshot["asym_score"] - prev["asym_score"]
    changes["asymmetry_change"] = int(as_delta)
    changes["asymmetry_trend"] = (
        "⬆️ More asymmetric" if as_delta > 0
        else "⬇️ More symmetric" if as_delta < 0
        else "➡️ Asymmetry unchanged"
    )

    # Roughness
    r_delta = snapshot["roughness"] - prev.get("roughness", 0)
    changes["roughness_change"] = round(float(r_delta), 2)
    changes["roughness_trend"] = (
        "⬆️ Skin thickening (lichenification)" if r_delta > 5
        else "⬇️ Skin smoothing" if r_delta < -5
        else "➡️ Texture stable"
    )

    # Overall evolution score (0–10)
    # Positive = worsening, negative = improving
    ev_score = (
        max(-2, min(2, int(np.sign(d_change_pct) if d_prev > 0 else 0))) +
        max(-2, min(2, int(cs_delta))) +
        max(-2, min(2, int(bs_delta))) +
        max(-2, min(2, int(as_delta))) +
        max(-2, min(2, int(np.sign(r_delta))))
    ) if "diameter_change_pct" in changes else 0

    ev_label = (
        "🔴 Significant worsening — consult dermatologist" if ev_score >= 4
        else "🟠 Mild worsening — monitor closely"         if ev_score >= 2
        else "🟡 Stable — no significant change"           if ev_score == 0
        else "🟢 Mild improvement — continue treatment"    if ev_score >= -3
        else "🟢 Clear improvement — good response"
    )

    # Append to history (keep last 10)
    history.append(snapshot)
    history = history[-10:]
    with open(history_file, "w") as f:
        json.dump(history, f, indent=2)

    return {
        "status":          "Comparison available",
        "previous_date":   prev["timestamp"][:10],
        "current_date":    snapshot["timestamp"][:10],
        "changes":         changes,
        "evolution_score": ev_score,
        "label":           ev_label
    }


# ══════════════════════════════════════════════
# 4. SEVERITY SCORE (0–10)
# ══════════════════════════════════════════════

def compute_severity_score(A, B, C, D, T) -> dict:
    """
    Weighted severity score 0–10 combining all ABCD + texture.
    Used as overall index for Pillar 3 treatment recommendation.
    """
    s_asym    = A["score"] / 2.0          * 2    # max 2
    s_border  = B["score"] / 3.0          * 2    # max 2
    s_color   = min(C["score"] / 4.0, 1)  * 2    # max 2
    s_size    = (0 if "Small"     in D["label"] else
                 0.5 if "Medium"  in D["label"] else
                 1.0 if "Large"   in D["label"] else 1.5)             # max 2
    s_texture = (0 if "smooth"  in T["label"].lower() else
                 0.5 if "Moderately" in T["label"] else 1.0)          # max 1
    s_red     = min(C.get("red_fraction", 0) * 4, 1.0)               # max 1

    total = s_asym + s_border + s_color + s_size + s_texture + s_red
    total = round(min(total, 10.0), 2)

    severity = ("Mild (0-3)"       if total <= 3
                else "Moderate (3-6)"  if total <= 6
                else "Severe (6-8)"    if total <= 8
                else "Very Severe (8-10)")

    return {"score": total, "severity": severity,
            "components": {
                "asymmetry":  round(s_asym,    2),
                "border":     round(s_border,  2),
                "color":      round(s_color,   2),
                "size":       round(s_size,    2),
                "texture":    round(s_texture, 2),
                "erythema":   round(s_red,     2),
            }}


# ══════════════════════════════════════════════
# 5. ABCDE REPORT BUILDER
# ══════════════════════════════════════════════

def build_abcde_report(processed: dict, box_idx: int,
                       original_box: dict, history_path: Path) -> dict:
    """Assemble full ABCDE report for one region."""
    roi  = processed["original"]
    mask = processed["lesion_mask"]          # already 256×256
    gray = processed["grayscale"]

    A  = compute_asymmetry(mask)
    B  = compute_border(mask)
    C  = compute_color(roi, mask)
    D  = compute_diameter(mask, roi.shape, original_box)
    T  = compute_texture(gray, mask)
    E  = compute_evolution(
             {"A_Asymmetry": A, "B_Border": B, "C_Color": C,
              "D_Diameter": D, "Texture_Bonus": T},
             history_path, box_idx)
    SV = compute_severity_score(A, B, C, D, T)

    summary = (
        f"Severity {SV['score']}/10 ({SV['severity']}). "
        f"Asymmetry: {A['label']}. "
        f"Border: {B['label']}. "
        f"Color: {C['label']}. "
        f"Size: {D['label']}. "
        f"Evolution: {E['label']}."
    )

    return {
        "region_index":    box_idx + 1,
        "A_Asymmetry":     A,
        "B_Border":        B,
        "C_Color":         C,
        "D_Diameter":      D,
        "Texture_Bonus":   T,
        "E_Evolution":     E,
        "Severity":        SV,
        "summary":         summary,
    }


# ══════════════════════════════════════════════
# 6. VISUALIZATIONS
# ══════════════════════════════════════════════

def save_processing_grid(processed: dict, box_idx: int, save_path: Path):
    panels = [
        ("Original ROI",         processed["original"],            False),
        ("CLAHE Enhanced",        processed["clahe_enhanced"],      False),
        ("Erythema Map",          processed["erythema_map"],        False),
        ("Lesion Mask (Adaptive)",processed["lesion_mask"],         True),
        ("Edge Detection",        processed["edges"],               True),
        ("Segmentation Overlay",  processed["segmentation_overlay"],False),
        ("GrabCut",               processed["grabcut"],             False),
        ("Watershed",             processed["watershed"],           False),
        ("Grayscale",             processed["grayscale"],           True),
    ]

    fig, axes = plt.subplots(3, 3, figsize=(14, 12))
    fig.patch.set_facecolor("#0d1117")
    fig.suptitle(f"Image Processing Pipeline — Region {box_idx + 1}",
                 color="white", fontsize=16, fontweight="bold", y=0.99)

    for ax, (title, img, is_gray) in zip(axes.flat, panels):
        if len(img.shape) == 2 or is_gray:
            ax.imshow(img if len(img.shape) == 2
                      else cv2.cvtColor(img, cv2.COLOR_BGR2GRAY),
                      cmap="magma")
        else:
            ax.imshow(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        ax.set_title(title, color="#b0c8e8", fontsize=9, pad=5)
        ax.axis("off")

    plt.tight_layout(rect=[0, 0, 1, 0.97])
    plt.savefig(save_path, dpi=150, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    plt.close()
    print(f"   💾 Processing grid  → {save_path}")


def save_cropped_region(roi_bgr: np.ndarray, mask: np.ndarray,
                        box_idx: int, save_dir: Path):
    roi_r   = cv2.resize(roi_bgr, (320, 320))
    mask_r  = cv2.resize(mask, (320, 320))
    overlay = roi_r.copy()
    cnts, _ = cv2.findContours(mask_r, cv2.RETR_EXTERNAL,
                                cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(overlay, cnts, -1, (0, 230, 120), 2)
    # Fill blobs with teal tint
    fill = np.zeros_like(roi_r)
    cv2.drawContours(fill, cnts, -1, (0, 180, 100), -1)
    overlay = cv2.addWeighted(overlay, 0.8, fill, 0.2, 0)

    combined = np.hstack([roi_r, overlay])
    path = save_dir / f"region_{box_idx + 1}_crop.jpg"
    cv2.imwrite(str(path), combined)
    print(f"   💾 Crop + mask      → {path}")
    return path


def save_abcde_visual(report: dict, roi_bgr: np.ndarray, save_path: Path):
    """Improved ABCDE report card with severity bars."""
    fig = plt.figure(figsize=(16, 9), facecolor="#0d1117")
    gs  = fig.add_gridspec(1, 2, width_ratios=[1, 1.6],
                            left=0.02, right=0.98,
                            top=0.95, bottom=0.05, wspace=0.08)

    # ── Left: image
    ax_img = fig.add_subplot(gs[0])
    ax_img.imshow(cv2.cvtColor(cv2.resize(roi_bgr, (320, 320)),
                                cv2.COLOR_BGR2RGB))
    ax_img.set_title(f"Region {report['region_index']}",
                     color="white", fontsize=14, pad=8)
    ax_img.axis("off")

    # ── Right: report
    ax = fig.add_subplot(gs[1])
    ax.set_facecolor("#0d1117")
    ax.axis("off")

    sv    = report["Severity"]
    ev    = report["E_Evolution"]
    A, B  = report["A_Asymmetry"], report["B_Border"]
    C, D  = report["C_Color"],     report["D_Diameter"]
    T     = report["Texture_Bonus"]

    # Title
    ax.text(0.0, 0.98, "ABCDE ECZEMA ANALYSIS",
            color="#f0c040", fontsize=17, fontweight="bold",
            va="top", transform=ax.transAxes)

    # Severity gauge
    sev_color = ("#44cc77" if sv["score"] <= 3 else
                 "#ffaa33" if sv["score"] <= 6 else
                 "#ff4444")
    ax.text(0.0, 0.91,
            f"Severity Score: {sv['score']}/10  —  {sv['severity']}",
            color=sev_color, fontsize=12, fontweight="bold",
            va="top", transform=ax.transAxes)

    # Score bar
    bar_y = 0.875
    bar_w = 0.92
    bar_h = 0.018
    ax.add_patch(FancyBboxPatch((0.0, bar_y), bar_w, bar_h,
                                boxstyle="round,pad=0.005",
                                facecolor="#1e2a3a", edgecolor="#333",
                                transform=ax.transAxes, zorder=2))
    ax.add_patch(FancyBboxPatch((0.0, bar_y),
                                bar_w * sv["score"] / 10, bar_h,
                                boxstyle="round,pad=0.005",
                                facecolor=sev_color, alpha=0.85,
                                transform=ax.transAxes, zorder=3))

    y = 0.83
    def row(letter, title, value, sub, color, score_val, max_score):
        nonlocal y
        ax.text(0.0, y, f"{letter}", color=color,
                fontsize=13, fontweight="bold", va="top",
                transform=ax.transAxes)
        ax.text(0.06, y, f"— {title}", color="#aaccee",
                fontsize=12, fontweight="bold", va="top",
                transform=ax.transAxes)
        ax.text(0.06, y - 0.048, f"    {value}", color="#dddddd",
                fontsize=10, va="top", transform=ax.transAxes)
        if sub:
            ax.text(0.06, y - 0.082, f"    {sub}", color="#778899",
                    fontsize=9, va="top", transform=ax.transAxes)
        # Mini score bar
        bw   = 0.25
        bh   = 0.012
        bx   = 0.69
        by   = y - 0.01
        ax.add_patch(FancyBboxPatch((bx, by), bw, bh,
                                    boxstyle="round,pad=0.003",
                                    facecolor="#1a2530", edgecolor="#334",
                                    transform=ax.transAxes, zorder=2))
        fill = (bw * score_val / max(max_score, 1)) if max_score > 0 else 0
        ax.add_patch(FancyBboxPatch((bx, by), fill, bh,
                                    boxstyle="round,pad=0.003",
                                    facecolor=color, alpha=0.75,
                                    transform=ax.transAxes, zorder=3))
        ax.text(bx + bw + 0.01, by + bh / 2,
                f"{score_val}/{max_score}",
                color="#aaaaaa", fontsize=8, va="center",
                transform=ax.transAxes)
        y -= 0.135

    row("A", "Asymmetry",
        A["label"],
        f"H={A['horizontal_asymmetry']}  V={A['vertical_asymmetry']}",
        "#60b4ff", A["score"], 2)

    row("B", "Border",
        B["label"],
        f"Circularity={B['circularity']}  Convexity={B['convexity_ratio']}",
        "#ff6b6b", B["score"], 3)

    row("C", "Color",
        C["label"],
        f"Variation std={C['color_variation_std']}",
        "#6bffb8", C["score"], 5)

    row("D", "Diameter / Size",
        D["label"],
        f"Est. {D['estimated_diameter_px']} px  |  Fill {int(D['fill_ratio']*100)}%",
        "#ffa94d", 0, 1)   # diameter bar is informational

    row("T", "Texture",
        T["label"],
        f"Contrast={T['glcm_contrast']}  Roughness={T.get('roughness_index',0)}",
        "#d0b4ff", 0, 1)

    # Evolution row
    ev_color = ("#44cc77" if ev["evolution_score"] <= -1
                else "#ffaa33" if ev["evolution_score"] == 0
                else "#ff6655")
    ax.text(0.0, y, "E", color=ev_color, fontsize=13,
            fontweight="bold", va="top", transform=ax.transAxes)
    ax.text(0.06, y, "— Evolution", color="#aaccee", fontsize=12,
            fontweight="bold", va="top", transform=ax.transAxes)
    ax.text(0.06, y - 0.048, f"    {ev['label']}",
            color="#dddddd", fontsize=10, va="top",
            transform=ax.transAxes)

    if ev.get("changes"):
        ch_lines = [f"{v}" for k, v in ev["changes"].items()
                    if "trend" in k]
        ch_str = "    " + "  |  ".join(ch_lines[:3])
        ax.text(0.06, y - 0.082, ch_str, color="#778899",
                fontsize=8, va="top", transform=ax.transAxes)

    # Summary
    y -= 0.16
    ax.plot([0.0, 0.95], [y + 0.02, y + 0.02],
            color="#333", lw=1, transform=ax.transAxes)
    ax.text(0.0, y, "SUMMARY", color="white", fontsize=11,
            fontweight="bold", va="top", transform=ax.transAxes)
    ax.text(0.0, y - 0.055, report["summary"],
            color="#cccccc", fontsize=8.5, va="top",
            wrap=True, transform=ax.transAxes)

    plt.savefig(save_path, dpi=150, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    plt.close()
    print(f"   💾 ABCDE report     → {save_path}")


def save_final_annotated(img_bgr: np.ndarray, boxes: list,
                          reports: list, save_path: Path):
    result = img_bgr.copy()
    palette = [(0,120,255),(0,200,100),(255,140,0),(180,0,220),(0,200,230)]

    for i, (box, rep) in enumerate(zip(boxes, reports)):
        x1, y1, x2, y2 = box["x1"], box["y1"], box["x2"], box["y2"]
        c   = palette[i % len(palette)]
        sv  = rep["Severity"]["score"]
        # Thickness reflects severity
        thick = 2 + int(sv / 3)
        cv2.rectangle(result, (x1, y1), (x2, y2), c, thick)

        label = (f"#{i+1} | Sev {sv}/10 | {rep['Severity']['severity']}")
        (lw, lh), _ = cv2.getTextSize(
            label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.rectangle(result,
                      (x1, max(0, y1 - lh - 10)),
                      (x1 + lw + 6, y1), c, -1)
        cv2.putText(result, label,
                    (x1 + 3, max(lh, y1 - 4)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45,
                    (255, 255, 255), 1)

    cv2.imwrite(str(save_path), result)
    print(f"   💾 Final annotated  → {save_path}")


# ══════════════════════════════════════════════
# 7. MAIN PIPELINE
# ══════════════════════════════════════════════

def run_pipeline(model_path: str, image_path: str, conf: float = 0.25):
    print("\n" + "=" * 60)
    print("  PILLAR 2 v2 — ECZEMA ABCDE PIPELINE")
    print("=" * 60)

    run_id  = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = OUTPUT_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    print(f"\n📁 Output folder : {run_dir}")
    print(f"📂 History folder: {HISTORY_DIR}")

    img_bgr, boxes = run_yolo_detection(model_path, image_path, conf)

    if not boxes:
        print("\n⚠️  No eczema regions detected.")
        # Write empty report so master_pipeline can proceed without crashing
        json_path = run_dir / "abcde_report.json"
        with open(json_path, "w") as f:
            json.dump([], f)
        cv2.imwrite(str(run_dir / "final_annotated.jpg"), img_bgr)
        print(f"\n✅ Pipeline complete! Outputs: {run_dir}")
        return run_dir, []

    all_reports = []
    print(f"\n[2/7] 🔬 Processing {len(boxes)} region(s)...\n")

    for i, box in enumerate(boxes):
        print(f"   ── Region {i+1}/{len(boxes)} ──")
        roi = img_bgr[box["y1"]:box["y2"], box["x1"]:box["x2"]]
        if roi.size == 0:
            print("   ⚠️  Empty ROI, skip.")
            continue

        processed = apply_preprocessing(roi)

        print("[3/7] 📊 Processing grid...")
        save_processing_grid(processed, i,
                             run_dir / f"region_{i+1}_processing_grid.png")

        print("[4/7] ✂️  Crop + mask...")
        save_cropped_region(roi, processed["lesion_mask"], i, run_dir)

        print("[5/7] 📋 ABCDE features...")
        report = build_abcde_report(processed, i, box, HISTORY_DIR)
        all_reports.append(report)

        print("[6/7] 🖼️  ABCDE report card...")
        save_abcde_visual(report, roi,
                          run_dir / f"region_{i+1}_abcde_report.png")
        print()

    print("[7/7] 🖼️  Final annotated image...")
    save_final_annotated(img_bgr, boxes, all_reports,
                         run_dir / "final_annotated.jpg")

    json_path = run_dir / "abcde_report.json"
    with open(json_path, "w") as f:
        json.dump(all_reports, f, indent=2)
    print(f"   💾 JSON report      → {json_path}")

    # Console summary
    print("\n" + "=" * 60)
    print("  📋 ABCDE ANALYSIS SUMMARY")
    print("=" * 60)
    for r in all_reports:
        print(f"\n  Region #{r['region_index']}")
        print(f"  A — Asymmetry  : {r['A_Asymmetry']['label']}")
        print(f"  B — Border     : {r['B_Border']['label']}")
        print(f"  C — Color      : {r['C_Color']['label']}")
        print(f"  D — Diameter   : {r['D_Diameter']['label']}")
        print(f"  T — Texture    : {r['Texture_Bonus']['label']}")
        print(f"  E — Evolution  : {r['E_Evolution']['label']}")
        print(f"  ★ Severity     : {r['Severity']['score']}/10"
              f" ({r['Severity']['severity']})")
        print(f"  ► {r['summary']}")

    print(f"\n✅ Pipeline complete! Outputs: {run_dir}")
    return run_dir, all_reports


# ══════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Eczema ABCDE Pipeline v2 (Pillar 2)")
    parser.add_argument("--model", required=True,
                        help="Path to YOLOv8 .pt weights file")
    parser.add_argument("--image", required=True,
                        help="Path to input image")
    parser.add_argument("--conf",  type=float, default=0.25,
                        help="YOLO confidence threshold (default 0.25)")
    args = parser.parse_args()
    result = run_pipeline(args.model, args.image, args.conf)
    if result is None:
        sys.exit(1)
