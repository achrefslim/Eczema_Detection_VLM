# backend_server.py
# Flask server — no database, uses JSON files for history storage

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import subprocess, json, os, sys, re, uuid
from datetime import datetime
import base64

app = Flask(__name__)
CORS(app)

# ──────────────────────────────────────────────
# PATHS CONFIG
# ──────────────────────────────────────────────
MASTER_PIPELINE_PATH = "master_pipeline.py"
TEMP_UPLOAD_DIR      = "temp_uploads"
OUTPUT_DIR           = "output"
REPORTS_DIR          = "reports"
HISTORY_DIR          = "history"          # ← JSON files saved here

os.makedirs(TEMP_UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR,      exist_ok=True)
os.makedirs(REPORTS_DIR,     exist_ok=True)
os.makedirs(HISTORY_DIR,     exist_ok=True)


# ══════════════════════════════════════════════
# JSON HISTORY HELPERS
# ══════════════════════════════════════════════

def save_report_to_json(report_data):
    """
    Save one report as a JSON file in history/.
    File name: {report_id}.json
    Returns the report_id string.
    """
    report_id = report_data.get('id') or str(uuid.uuid4())
    report_data['id'] = report_id
    file_path = os.path.join(HISTORY_DIR, f"{report_id}.json")
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(report_data, f, ensure_ascii=False, indent=2)
    print(f"[INFO] Report saved → {file_path}")
    return report_id


def get_all_reports(user_id):
    """
    Read all JSON files in history/ that belong to user_id.
    Returns list sorted by created_at descending (newest first).
    """
    reports = []
    try:
        for filename in os.listdir(HISTORY_DIR):
            if not filename.endswith('.json'):
                continue
            file_path = os.path.join(HISTORY_DIR, filename)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if data.get('user_id') == user_id:
                    reports.append(data)
            except Exception as e:
                print(f"[WARN] Could not read {filename}: {e}")
    except Exception as e:
        print(f"[ERROR] get_all_reports: {e}")

    # Sort newest first
    reports.sort(key=lambda r: r.get('created_at', ''), reverse=True)
    return reports


def get_report_by_id(report_id):
    """Read one JSON file by its id."""
    file_path = os.path.join(HISTORY_DIR, f"{report_id}.json")
    if not os.path.exists(file_path):
        return None
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"[ERROR] get_report_by_id: {e}")
        return None


def delete_report_json(report_id, user_id):
    """
    Delete the JSON file for a report.
    Only deletes if the report belongs to user_id.
    Returns True if deleted, False otherwise.
    """
    file_path = os.path.join(HISTORY_DIR, f"{report_id}.json")
    if not os.path.exists(file_path):
        return False
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if data.get('user_id') != user_id:
            print(f"[WARN] Delete rejected — user mismatch for report {report_id}")
            return False
        os.remove(file_path)
        print(f"[INFO] Report deleted → {file_path}")
        return True
    except Exception as e:
        print(f"[ERROR] delete_report_json: {e}")
        return False


# ══════════════════════════════════════════════
# GEMINI TEXT PARSER (unchanged)
# ══════════════════════════════════════════════

def parse_gemini_text(text):
    if not text:
        return {}
    sections = {}
    parts = re.split(r'\n##\s+', '\n' + text)
    for part in parts:
        lines = part.strip().split('\n')
        if not lines or not lines[0].strip():
            continue
        heading = lines[0].strip().upper().rstrip(':')
        body    = '\n'.join(lines[1:]).strip()
        sections[heading] = body
    return sections

def clean_line(line):
    line = re.sub(r'^\s*[\*\-•]\s*', '', line).strip()
    line = re.sub(r'\*\*(.*?)\*\*', r'\1', line).strip()
    line = re.sub(r'\*(.*?)\*',     r'\1', line).strip()
    line = line.lstrip(':').strip()
    return line

def parse_treatment_sections(text):
    if not text:
        return []
    result = []
    sub_parts = re.split(r'\n###\s+', '\n' + text)
    for part in sub_parts:
        lines = part.strip().split('\n')
        if not lines:
            continue
        title = clean_line(lines[0])
        if not title or title.lower().startswith('what this means'):
            continue
        items = []
        for line in lines[1:]:
            if 'what this means' in line.lower():
                break
            c = clean_line(line)
            if c and len(c) > 5:
                items.append(c)
        if title and items:
            result.append({'title': title, 'items': items})
    if not result:
        items = []
        for line in text.split('\n'):
            if 'what this means' in line.lower():
                continue
            c = clean_line(line)
            if c and len(c) > 8:
                items.append(c)
        if items:
            result.append({'title': 'Recommendations', 'items': items})
    return result

def parse_bullet_list(text):
    if not text:
        return []
    items = []
    for line in text.split('\n'):
        if 'what this means' in line.lower():
            continue
        if line.strip().startswith('##'):
            break
        c = clean_line(line)
        if c and len(c) > 8:
            items.append(c)
    return items

def extract_gemini_sections(raw_text):
    sections           = parse_gemini_text(raw_text)
    treatment_sections = parse_treatment_sections(sections.get('RECOMMENDED TREATMENT PLAN', ''))
    lifestyle_items    = parse_bullet_list(sections.get('LIFESTYLE & PREVENTION ADVICE', ''))
    doctor_items       = parse_bullet_list(sections.get('WHEN TO SEE A DOCTOR', ''))
    followup_items     = parse_bullet_list(sections.get('FOLLOW-UP SCHEDULE', ''))
    summary_raw        = sections.get('EXECUTIVE SUMMARY', '')
    summary            = summary_raw.split('**What this means')[0].strip() if summary_raw else ''
    diag_section       = sections.get('DIAGNOSIS', '')
    diag_match         = re.search(r'Primary Diagnosis[:\s]*(.*?)(?:\.|$)', diag_section, re.IGNORECASE)
    diag_name          = diag_match.group(1).strip().strip('*').strip() if diag_match else ''
    phase_raw          = sections.get('ECZEMA TYPE & PHASE', '')
    phase_text         = phase_raw.split('**What this means')[0].strip()
    return {
        'treatmentSections': treatment_sections,
        'lifestyleAdvice':   lifestyle_items,
        'whenToSeeDoctor':   doctor_items,
        'followUpSchedule':  followup_items,
        'executiveSummary':  summary,
        'diagnosisName':     diag_name,
        'eczemaPhase':       phase_text,
    }

def find_latest_gemini_txt():
    try:
        txts = [f for f in os.listdir(REPORTS_DIR) if f.startswith('raw_gemini') and f.endswith('.txt')]
        if not txts:
            return None
        return os.path.join(REPORTS_DIR, max(txts, key=lambda f: os.path.getmtime(os.path.join(REPORTS_DIR, f))))
    except Exception:
        return None


# ══════════════════════════════════════════════
# UTILITIES
# ══════════════════════════════════════════════

def image_to_base64(path):
    if path and os.path.exists(path):
        with open(path, 'rb') as f:
            return base64.b64encode(f.read()).decode('utf-8')
    return None

def severity_label_from_score(score):
    try:
        s = float(score)
        return 'Low' if s <= 3.5 else 'High' if s > 6.5 else 'Moderate'
    except:
        return 'Moderate'

def find_latest_output_dir():
    try:
        dirs = [d for d in os.listdir(OUTPUT_DIR) if os.path.isdir(os.path.join(OUTPUT_DIR, d))]
        if not dirs:
            return None
        return os.path.join(OUTPUT_DIR, max(dirs, key=lambda d: os.path.getmtime(os.path.join(OUTPUT_DIR, d))))
    except:
        return None

def find_latest_pdf():
    try:
        pdfs = [f for f in os.listdir(REPORTS_DIR) if f.startswith('dermatology_report') and f.endswith('.pdf')]
        if not pdfs:
            return None
        return os.path.join(REPORTS_DIR, max(pdfs, key=lambda f: os.path.getmtime(os.path.join(REPORTS_DIR, f))))
    except:
        return None


# ══════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status':  'ok',
        'server':  'running',
        'storage': 'json files',
        'history': f'{len(os.listdir(HISTORY_DIR))} reports saved'
    })


# ──────────────────────────────────────────────
# POST /api/analyze
# ──────────────────────────────────────────────
@app.route('/api/analyze', methods=['POST'])
def analyze_image():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image uploaded'}), 400

        image_file  = request.files['image']
        patient_raw = request.form.get('patientData', '{}')
        user_id     = request.form.get('userId', 'anonymous')

        try:
            patient_data = json.loads(patient_raw)
        except:
            return jsonify({'error': 'Invalid patientData'}), 400

        # Save uploaded image
        timestamp  = datetime.now().strftime('%Y%m%d_%H%M%S')
        image_path = os.path.join(TEMP_UPLOAD_DIR, f"upload_{timestamp}.jpg")
        image_file.save(image_path)
        print(f"[INFO] Image saved → {image_path}")

        # Build prompt
        name     = patient_data.get('name',        'Unknown')
        age      = patient_data.get('age',          'Unknown')
        age_unit = patient_data.get('ageUnit',      'years')
        duration = patient_data.get('duration',     'Unknown')
        desc     = patient_data.get('description',  '')
        prompt   = f"Patient: {name}, Age: {age} {age_unit}. Symptoms started: {duration}. Description: {desc}"

        # Run master pipeline
        print(f"[INFO] Starting master pipeline...")
        result = subprocess.run(
            [sys.executable, MASTER_PIPELINE_PATH, '--image', image_path, '--prompt', prompt],
            capture_output=True, text=True, encoding='utf-8', errors='replace',
            timeout=300,
            env={**os.environ, 'PYTHONIOENCODING': 'utf-8'}
        )
        if result.returncode != 0:
            # Prefer stderr (actual exceptions) over stdout (pipeline progress logs)
            error_output = result.stderr.strip() or result.stdout.strip()
            print(f"[ERROR] Pipeline stderr:\n{result.stderr.strip()}")
            print(f"[ERROR] Pipeline stdout:\n{result.stdout.strip()}")
            return jsonify({'error': f'Pipeline failed: {error_output[:3000]}'}), 500

        # Locate outputs
        output_path = find_latest_output_dir()
        if not output_path:
            return jsonify({'error': 'No output directory'}), 500

        abcde_json_path = os.path.join(output_path, 'abcde_report.json')
        annotated_path  = os.path.join(output_path, 'final_annotated.jpg')
        pdf_path        = find_latest_pdf()

        if not os.path.exists(abcde_json_path):
            return jsonify({'error': 'ABCDE JSON not found'}), 500

        with open(abcde_json_path, 'r', encoding='utf-8') as f:
            abcde_data = json.load(f)

        # Extract ABCDE fields
        if isinstance(abcde_data, list):
            regions = abcde_data
            if not regions:
                orig_b64 = image_to_base64(image_path)
                return jsonify({
                    'success':              True,
                    'reportId':             None,
                    'diagnosis':            'No eczema detected',
                    'diagnosisDescription': 'YOLO analysis found no eczema lesions in the uploaded image.',
                    'overallSeverity':      0,
                    'severityLabel':        'None',
                    'regions':              [],
                    'treatment':            {},
                    'treatmentSections':    [],
                    'lifestyleAdvice':      [],
                    'whenToSeeDoctor':      [],
                    'followUpSchedule':     [],
                    'executiveSummary':     'No eczema regions were detected in this image.',
                    'eczemaPhase':          '',
                    'originalImageUrl':     f'data:image/jpeg;base64,{orig_b64}' if orig_b64 else None,
                    'annotatedImageUrl':    None,
                    'pdfAvailable':         False,
                })
            scores           = [r.get('Severity', {}).get('score', 0) for r in regions]
            overall_severity = max(scores) if scores else 5.0
            diagnosis        = 'Eczema Detected'
            diagnosis_desc   = ''
            treatment        = {}
        else:
            regions          = abcde_data.get('regions', [])
            overall_severity = abcde_data.get('overall_severity', 5.0)
            diagnosis        = abcde_data.get('diagnosis', 'Eczema Detected')
            diagnosis_desc   = abcde_data.get('description', '')
            treatment        = abcde_data.get('treatment_recommendations', {})

        severity_label = severity_label_from_score(overall_severity)

        # Parse Gemini raw text
        gemini_sections = {}
        gemini_txt_path = find_latest_gemini_txt()
        if gemini_txt_path:
            try:
                with open(gemini_txt_path, 'r', encoding='utf-8') as f:
                    raw_text = f.read()
                gemini_sections = extract_gemini_sections(raw_text)
                print(f"[INFO] Gemini text parsed → {gemini_txt_path}")
                if gemini_sections.get('diagnosisName'):
                    diagnosis = gemini_sections['diagnosisName']
            except Exception as e:
                print(f"[WARN] Gemini parse failed: {e}")

        treatment_formatted = {
            'whatToDo':    treatment.get('what_to_do',    ''),
            'whatNotToDo': treatment.get('what_not_to_do', '')
        }

        # ── Save to JSON file (replaces MySQL) ──────────────────────
        annotated_exists = os.path.exists(annotated_path)
        report_data = {
            'user_id':              user_id,
            'patient_name':         name,
            'patient_age':          age,
            'age_unit':             age_unit,
            'problem_duration':     duration,
            'description':          desc,
            'diagnosis':            diagnosis,
            'diagnosis_description': diagnosis_desc,
            'overall_severity':     overall_severity,
            'severity_label':       severity_label,
            'regions':              regions,
            'treatment':            treatment_formatted,
            'gemini_sections':      gemini_sections,
            'original_image_path':  image_path,
            'annotated_image_path': annotated_path if annotated_exists else '',
            'pdf_report_path':      pdf_path or '',
            'created_at':           datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        }
        report_id = save_report_to_json(report_data)
        print(f"[INFO] Report saved → id={report_id}")

        # Build response
        orig_b64      = image_to_base64(image_path)
        annotated_b64 = image_to_base64(annotated_path) if annotated_exists else None

        return jsonify({
            'success':              True,
            'reportId':             report_id,
            'diagnosis':            diagnosis,
            'diagnosisDescription': diagnosis_desc,
            'overallSeverity':      overall_severity,
            'severityLabel':        severity_label,
            'regions':              regions,
            'treatment':            treatment_formatted,
            'treatmentSections':    gemini_sections.get('treatmentSections',  []),
            'lifestyleAdvice':      gemini_sections.get('lifestyleAdvice',    []),
            'whenToSeeDoctor':      gemini_sections.get('whenToSeeDoctor',    []),
            'followUpSchedule':     gemini_sections.get('followUpSchedule',   []),
            'executiveSummary':     gemini_sections.get('executiveSummary',   ''),
            'eczemaPhase':          gemini_sections.get('eczemaPhase',        ''),
            'originalImageUrl':     f'data:image/jpeg;base64,{orig_b64}'      if orig_b64      else None,
            'annotatedImageUrl':    f'data:image/jpeg;base64,{annotated_b64}' if annotated_b64 else None,
            'pdfAvailable':         pdf_path is not None,
        })

    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Pipeline timed out after 5 minutes'}), 500
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500


# ──────────────────────────────────────────────
# GET /api/history/<user_id>
# ──────────────────────────────────────────────
@app.route('/api/history/<user_id>', methods=['GET'])
def get_history(user_id):
    try:
        reports = get_all_reports(user_id)
        return jsonify({'success': True, 'data': reports})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# ──────────────────────────────────────────────
# GET /api/report/<report_id>
# ──────────────────────────────────────────────
@app.route('/api/report/<report_id>', methods=['GET'])
def get_report_detail(report_id):
    try:
        row = get_report_by_id(report_id)
        if not row:
            return jsonify({'error': 'Not found'}), 404
        # Attach base64 images
        for key, path_field in [('originalImageUrl', 'original_image_path'), ('annotatedImageUrl', 'annotated_image_path')]:
            b64 = image_to_base64(row.get(path_field, ''))
            row[key] = f'data:image/jpeg;base64,{b64}' if b64 else None
        row['pdfAvailable'] = bool(row.get('pdf_report_path') and os.path.exists(row['pdf_report_path']))
        return jsonify({'success': True, 'data': row})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ──────────────────────────────────────────────
# GET /api/download/<report_id>
# ──────────────────────────────────────────────
@app.route('/api/download/<report_id>', methods=['GET'])
def download_report(report_id):
    try:
        row = get_report_by_id(report_id)
        if not row:
            return jsonify({'error': 'Not found'}), 404
        pdf_path = row.get('pdf_report_path', '')
        if not pdf_path or not os.path.exists(pdf_path):
            return jsonify({'error': 'PDF not found'}), 404
        patient = row.get('patient_name', 'patient').replace(' ', '_')
        return send_file(pdf_path, mimetype='application/pdf', as_attachment=True,
                         download_name=f'skinsight_report_{patient}_{report_id[:8]}.pdf')
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ──────────────────────────────────────────────
# DELETE /api/report/<report_id>
# ──────────────────────────────────────────────
@app.route('/api/report/<report_id>', methods=['DELETE'])
def delete_report(report_id):
    try:
        user_id = request.args.get('userId')
        if not user_id:
            return jsonify({'error': 'userId required'}), 400
        deleted = delete_report_json(report_id, user_id)
        if deleted:
            return jsonify({'success': True})
        return jsonify({'error': 'Not found or not yours'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ──────────────────────────────────────────────
# GET /api/image/<report_id>
# Serve thumbnail image for history cards
# ──────────────────────────────────────────────
@app.route('/api/image/<report_id>', methods=['GET'])
def get_report_image(report_id):
    try:
        row = get_report_by_id(report_id)
        if not row:
            return jsonify({'error': 'Not found'}), 404
        path = row.get('original_image_path', '')
        if not path or not os.path.exists(path):
            return jsonify({'error': 'Image not found'}), 404
        return send_file(path, mimetype='image/jpeg')
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ══════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════
if __name__ == '__main__':
    print("=" * 60)
    print("  SkinSight AI — Backend Server")
    print("  Storage: JSON files in history/")
    print("  Server  → http://localhost:5000")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)