"""
================================================================
  MASTER PIPELINE — FULL ECZEMA DETECTION SYSTEM
  Chains Pillar 1 (YOLO) → Pillar 2 (ABCDE) → Pillar 3 (VLM Report)
  
  Usage:
    python master_pipeline.py --image photo.jpg --prompt "Patient description"
  
  Outputs:
    - Pillar 2 results in output/TIMESTAMP/
    - Pillar 3 PDF report in reports/
================================================================
"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import argparse
import subprocess
from pathlib import Path
from datetime import datetime
import shutil

# ──────────────────────────────────────────────
# CONFIG — Edit these paths if needed
# ──────────────────────────────────────────────
YOLO_MODEL_PATH    = "best.pt"              # YOLOv8 weights
PATHOLOGY_EXCEL    = "pathology.xlsx"        # Knowledge base
PILLAR2_SCRIPT     = "eczema_pipeline_v2.py"
PILLAR3_SCRIPT     = "pillar3_report.py"
CONFIDENCE_THRESH  = 0.25                    # YOLO detection threshold

# Output directories
OUTPUT_BASE = Path("output")
REPORTS_DIR = Path("reports")
OUTPUT_BASE.mkdir(exist_ok=True)
REPORTS_DIR.mkdir(exist_ok=True)


# ══════════════════════════════════════════════
# MASTER PIPELINE ORCHESTRATOR
# ══════════════════════════════════════════════

def run_master_pipeline(image_path: str, user_prompt: str, conf: float = CONFIDENCE_THRESH):
    """
    Run complete 3-pillar pipeline:
    1. Pillar 2 (includes Pillar 1 YOLO internally)
    2. Pillar 3 (VLM report generation)
    """
    
    print("\n" + "=" * 70)
    print("  🔬 ECZEMA DETECTION SYSTEM — MASTER PIPELINE")
    print("=" * 70)
    print(f"\n📷 Input Image : {image_path}")
    print(f"🧠 YOLO Model  : {YOLO_MODEL_PATH}")
    print(f"📊 Confidence  : {conf}")
    print(f"💬 User Prompt : {user_prompt[:60]}..." if len(user_prompt) > 60 else f"💬 User Prompt : {user_prompt}")
    
    # Validate inputs
    if not Path(image_path).exists():
        print(f"\n❌ Error: Image not found: {image_path}")
        return None
    if not Path(YOLO_MODEL_PATH).exists():
        print(f"\n❌ Error: YOLO model not found: {YOLO_MODEL_PATH}")
        return None
    if not Path(PATHOLOGY_EXCEL).exists():
        print(f"\n❌ Error: Pathology Excel not found: {PATHOLOGY_EXCEL}")
        return None
    if not Path(PILLAR2_SCRIPT).exists():
        print(f"\n❌ Error: Pillar 2 script not found: {PILLAR2_SCRIPT}")
        return None
    if not Path(PILLAR3_SCRIPT).exists():
        print(f"\n❌ Error: Pillar 3 script not found: {PILLAR3_SCRIPT}")
        return None
    
    # ──────────────────────────────────────────────────────────────
    # STEP 1: Run Pillar 2 (YOLO + ABCDE Analysis)
    # ──────────────────────────────────────────────────────────────
    print("\n" + "─" * 70)
    print("STEP 1/2 — Running Pillar 2 (YOLO Detection + ABCDE Analysis)")
    print("─" * 70)
    
    cmd_pillar2 = [
        sys.executable,  # Use same Python interpreter
        PILLAR2_SCRIPT,
        "--model", YOLO_MODEL_PATH,
        "--image", image_path,
        "--conf", str(conf)
    ]
    
    try:
        result = subprocess.run(cmd_pillar2, check=True, capture_output=True, text=True, encoding='utf-8', errors='replace')
        print(result.stdout)
        
        # Parse output to find the run directory
        pillar2_output_dir = None
        for line in result.stdout.splitlines():
            if "Pipeline complete! Outputs:" in line:
                pillar2_output_dir = line.split("Outputs:")[-1].strip()
                break
        
        if not pillar2_output_dir:
            # Fallback: find most recent output directory
            output_dirs = sorted(OUTPUT_BASE.glob("*"), key=lambda p: p.stat().st_mtime)
            if output_dirs:
                pillar2_output_dir = str(output_dirs[-1])
        
        if not pillar2_output_dir or not Path(pillar2_output_dir).exists():
            print("\n❌ Error: Could not locate Pillar 2 output directory")
            return None
            
        print(f"\n✅ Pillar 2 Complete → {pillar2_output_dir}")
        
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Pillar 2 failed with error:")
        if e.stderr:
            print(e.stderr)
        if e.output:
            print(e.output)
        return None
    except Exception as e:
        print(f"\n❌ Pillar 2 failed with unexpected error: {e}")
        # Still try to find output directory
        output_dirs = sorted(OUTPUT_BASE.glob("*"), key=lambda p: p.stat().st_mtime)
        if output_dirs:
            pillar2_output_dir = str(output_dirs[-1])
            print(f"   Found output directory: {pillar2_output_dir}")
        else:
            return None
    
    # ──────────────────────────────────────────────────────────────
    # STEP 2: Prepare inputs for Pillar 3
    # ──────────────────────────────────────────────────────────────
    pillar2_dir = Path(pillar2_output_dir)
    json_path = pillar2_dir / "abcde_report.json"
    annotated_img = pillar2_dir / "final_annotated.jpg"
    
    if not json_path.exists():
        print(f"\n❌ Error: ABCDE JSON not found: {json_path}")
        return None
    if not annotated_img.exists():
        print(f"\n❌ Error: Annotated image not found: {annotated_img}")
        return None
    
    # ──────────────────────────────────────────────────────────────
    # STEP 3: Run Pillar 3 (VLM Report Generation)
    # ──────────────────────────────────────────────────────────────
    print("\n" + "─" * 70)
    print("STEP 2/2 — Running Pillar 3 (VLM Medical Report Generation)")
    print("─" * 70)
    
    cmd_pillar3 = [
        sys.executable,
        PILLAR3_SCRIPT,
        "--json", str(json_path),
        "--original", image_path,
        "--annotated", str(annotated_img),
        "--pathology", PATHOLOGY_EXCEL,
        "--prompt", user_prompt
    ]
    
    try:
        result = subprocess.run(cmd_pillar3, check=True, capture_output=True, text=True, encoding='utf-8', errors='replace')
        print(result.stdout)
        
        # Parse output to find PDF report path
        pdf_path = None
        for line in result.stdout.splitlines():
            if "PDF Report" in line and ".pdf" in line:
                pdf_path = line.split(":")[-1].strip()
                break
        
        if not pdf_path:
            # Fallback: find most recent PDF in reports/
            pdf_files = sorted(REPORTS_DIR.glob("dermatology_report_*.pdf"), 
                             key=lambda p: p.stat().st_mtime)
            if pdf_files:
                pdf_path = str(pdf_files[-1])
        
        if not pdf_path or not Path(pdf_path).exists():
            print("\n⚠️  Warning: Could not locate PDF report (check reports/ folder manually)")
            pdf_path = "reports/ (check folder)"
        else:
            print(f"\n✅ Pillar 3 Complete → {pdf_path}")
        
    except subprocess.CalledProcessError as e:
        stderr_out = (e.stderr or "").strip()
        stdout_out = (e.output or "").strip()
        error_detail = stderr_out or stdout_out or "No error output captured"
        print(f"\n❌ Pillar 3 failed:\n{error_detail}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"\n❌ Pillar 3 unexpected error: {e}", file=sys.stderr)
        return None
    
    # ──────────────────────────────────────────────────────────────
    # FINAL SUMMARY
    # ──────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("  ✅ MASTER PIPELINE COMPLETE")
    print("=" * 70)
    print(f"\n📂 Pillar 2 Output : {pillar2_output_dir}")
    print(f"   ├─ abcde_report.json")
    print(f"   ├─ final_annotated.jpg")
    print(f"   ├─ region_*_processing_grid.png")
    print(f"   ├─ region_*_abcde_report.png")
    print(f"   └─ region_*_crop.jpg")
    print(f"\n📄 Pillar 3 Report : {pdf_path}")
    print(f"   └─ Professional PDF dermatology report\n")
    
    return {
        "pillar2_dir": pillar2_output_dir,
        "pdf_report": pdf_path,
        "json_report": str(json_path),
        "annotated_image": str(annotated_img)
    }


# ══════════════════════════════════════════════
# CLI ENTRY POINT
# ══════════════════════════════════════════════

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Master Pipeline — Full Eczema Detection System (Pillar 1+2+3)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python master_pipeline.py --image photo.jpg --prompt "6-month-old infant, cheeks, itching at night"
  python master_pipeline.py --image hand.jpg --prompt "Child, hand eczema, scratching, no prior treatment" --conf 0.3

Output:
  • Pillar 2 outputs in output/TIMESTAMP/
  • Pillar 3 PDF report in reports/
        """
    )
    
    parser.add_argument("--image", required=True,
                        help="Path to input skin image (jpg/png)")
    parser.add_argument("--prompt", required=True,
                        help="Patient clinical description (wrap in quotes)")
    parser.add_argument("--conf", type=float, default=CONFIDENCE_THRESH,
                        help=f"YOLO confidence threshold (default: {CONFIDENCE_THRESH})")
    
    args = parser.parse_args()
    
    result = run_master_pipeline(
        image_path=args.image,
        user_prompt=args.prompt,
        conf=args.conf
    )
    
    if result:
        sys.exit(0)  # Success
    else:
        sys.exit(1)  # Failure
