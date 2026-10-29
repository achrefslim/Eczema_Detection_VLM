# Eczema Detection using VLM (SkinSight AI)

SkinSight AI is a complete system that detects eczema on skin photos, measures each lesion with classic image processing, and then uses a Vision Language Model (Google Gemini) to write a full dermatology style report in PDF format. It comes with a web application where a doctor can sign in, upload a photo, fill a short patient questionnaire and receive the analysis, the annotated image and the downloadable report.

> **Medical disclaimer:** this project is an academic prototype. It is not a medical device and must not replace the opinion of a qualified dermatologist.

## Table of contents

1. [How it works](#how-it-works)
2. [Main features](#main-features)
3. [Project structure](#project-structure)
4. [Technologies](#technologies)
5. [Quick start](#quick-start)
6. [API endpoints](#api-endpoints)
7. [Outputs](#outputs)
8. [Severity score](#severity-score)
9. [Privacy and security](#privacy-and-security)
10. [Limitations and future work](#limitations-and-future-work)

For a full step by step guide, read [TUTORIAL.md](TUTORIAL.md).

## How it works

The system is built around three pillars that run one after the other.

| Step | Input | Processing | Output |
|:---:|---|---|---|
| 1 | Skin photo | YOLOv8 detection with `best.pt` | Boxes around every eczema region |
| 2 | Detected regions | ABCDE image analysis (segmentation, asymmetry, border, color, diameter, evolution, texture) | `abcde_report.json` and annotated image |
| 3 | Photos, ABCDE metrics, patient description, `pathology.xlsx` | Gemini Vision Language Model | Structured medical text |
| 4 | Medical text | ReportLab PDF builder | Professional PDF dermatology report |

**Pillar 1, detection.** A YOLOv8 model trained on eczema images (`best.pt`) locates every affected region in the photo.

**Pillar 2, quantitative analysis.** Each detected region is cropped and processed with OpenCV and scikit image. The lesion is isolated with a fallback chain of segmentation methods, then the ABCDE criteria are computed:

| Letter | Criterion | What is measured |
|:---:|---|---|
| A | Asymmetry | Overlap of the lesion mask with its own mirror on both axes |
| B | Border | Irregularity and compactness of the contour |
| C | Color | Number of dominant colors and redness (erythema) fraction |
| D | Diameter | Real size of the lesion computed on the original resolution |
| E | Evolution | Change compared with the previous analysis of the same region |

Texture (GLCM) is also extracted, and everything is combined into a single severity score between 0 and 10.

**Pillar 3, VLM report.** The original photo, the annotated photo, the ABCDE summary, the patient description and a pathology table are sent to Gemini. The model returns a structured report (executive summary, visual analysis, diagnosis, differential diagnosis, eczema type and phase, severity, treatment plan, lifestyle advice, when to see a doctor, follow up schedule). The text is converted into a styled multi page PDF with ReportLab.

## Main features

1. Automatic eczema region detection with YOLOv8
2. Full ABCDE lesion analysis with visual report cards for every region
3. Evolution tracking between successive analyses of the same patient
4. Severity score from 0 to 10 with a clear label (Mild, Moderate, Severe, Very Severe)
5. Medical report written by a Vision Language Model, enriched with a pathology knowledge base
6. Professional PDF export
7. Web application with secure sign in (Firebase), image upload, patient questionnaire, results page, report history, settings, dark mode and an interactive user guide
8. Command line mode to run the full pipeline without the web interface

## Project structure

```
Eczema_Detection_VLM/
|
|  backend_server.py        Flask REST API used by the web app
|  master_pipeline.py       Runs Pillar 2 then Pillar 3 with one command
|  eczema_pipeline_v2.py    Pillar 1 and 2 (YOLO detection and ABCDE analysis)
|  pillar3_report.py        Pillar 3 (Gemini report and PDF generation)
|  best.pt                  Trained YOLOv8 weights
|  pathology.xlsx           Pathology knowledge base used by the VLM
|  requirements.txt         Python dependencies
|  .env.example             Template for the Gemini API key
|  README.md
|  TUTORIAL.md
|
|__ eczema-app/             React web application
    |  package.json
    |  .env.example         Template for the Firebase configuration
    |__ public/
    |__ src/
        |  App.js
        |__ components/     ImageUpload, PatientQuestionnaire, AnalysisResults,
        |                   ReportsHistory, UserGuide
        |__ pages/          Login, SignUp, Dashboard, Settings
        |__ context/        Authentication and theme (light or dark)
        |__ services/       Calls to the Flask API
        |__ firebase/       Firebase initialisation
```

The folders `output/`, `reports/`, `history/` and `temp_uploads/` are created automatically when the system runs.

## Technologies

| Part | Tools |
|---|---|
| Detection | Ultralytics YOLOv8, PyTorch |
| Image processing | OpenCV, scikit image, NumPy, SciPy, Matplotlib |
| Vision Language Model | Google Gemini through the google genai SDK |
| Report | ReportLab, Pandas, OpenPyXL |
| Backend | Flask, Flask CORS, python dotenv |
| Frontend | React 18, Material UI, Framer Motion, Axios, React Router |
| Authentication | Firebase Authentication and Firestore |

## Quick start

You need Python 3.10 or newer, Node.js 18 or newer, a Gemini API key from [Google AI Studio](https://aistudio.google.com) and a Firebase project (only for the web app).

**1. Clone the project**

```bash
git clone https://github.com/achrefslim/Eczema_Detection_VLM.git
cd Eczema_Detection_VLM
```

**2. Install the Python dependencies**

```bash
pip install -r requirements.txt
```

**3. Add your Gemini key**

Copy `.env.example` to `.env` and write your key inside.

**4. Run the pipeline from the command line**

```bash
python master_pipeline.py --image my_photo.jpg --prompt "6 month old infant, red patches on both cheeks, itching at night"
```

**5. Or run the full web application**

```bash
python backend_server.py
```

Then in a second terminal:

```bash
cd eczema-app
npm install
npm start
```

Open http://localhost:3000 in your browser.

All the details (Firebase setup, every screen of the app, troubleshooting) are in [TUTORIAL.md](TUTORIAL.md).

## API endpoints

The Flask server listens on port 5000.

| Method | Route | Description |
|---|---|---|
| GET | `/api/health` | Server status |
| POST | `/api/analyze` | Upload an image with `patientData` and `userId`, runs the full pipeline and returns the results |
| GET | `/api/history/<user_id>` | All reports of a user, newest first |
| GET | `/api/report/<report_id>` | One report with its images |
| GET | `/api/download/<report_id>` | Download the PDF report |
| GET | `/api/image/<report_id>` | Original image of a report |
| DELETE | `/api/report/<report_id>?userId=...` | Delete a report that belongs to the user |

## Outputs

Every analysis produces:

| Location | File | Content |
|---|---|---|
| `output/TIMESTAMP/` | `abcde_report.json` | All the ABCDE metrics in JSON |
| `output/TIMESTAMP/` | `final_annotated.jpg` | Photo with detected regions and severity |
| `output/TIMESTAMP/` | `region_N_processing_grid.png` | Nine panel view of the image processing steps |
| `output/TIMESTAMP/` | `region_N_abcde_report.png` | ABCDE report card of the region |
| `output/TIMESTAMP/` | `region_N_crop.jpg` | Cropped region with its segmentation |
| `reports/` | `dermatology_report_TIMESTAMP.pdf` | Final medical report |
| `reports/` | `raw_gemini_TIMESTAMP.txt` | Raw text returned by the VLM |
| `history/` | `*.json` | Saved reports and evolution history |

## Severity score

The score combines six components:

| Component | Maximum |
|---|:---:|
| Asymmetry | 2 |
| Border | 2 |
| Color | 2 |
| Size | 2 |
| Texture | 1 |
| Erythema (redness) | 1 |

| Score | Label |
|:---:|---|
| 0 to 3 | Mild |
| 3 to 6 | Moderate |
| 6 to 8 | Severe |
| 8 to 10 | Very Severe |

## Privacy and security

1. No API key is stored in the code. The Gemini key lives in `.env` and the Firebase values in `eczema-app/.env`. Both files are ignored by git.
2. Uploaded photos, generated reports and history files stay on the machine that runs the server and are ignored by git.
3. No patient photo is included in this repository. Use your own images or public dermatology datasets that allow it.

## Limitations and future work

1. The model was trained on a limited dataset, so results depend strongly on photo quality and lighting.
2. The free tier of Gemini has a daily quota. A second key can be added in `.env` as a fallback.
3. History is stored in JSON files. A real database would be better for many users.
4. Future ideas: support more skin diseases, run a local open source VLM, add a mobile app and a clinical validation with dermatologists.

## Author

[achrefslim](https://github.com/achrefslim)

## License

This project is shared for educational and research purposes.
