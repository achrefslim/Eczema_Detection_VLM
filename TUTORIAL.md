# Tutorial: using SkinSight AI step by step

This tutorial takes you from an empty computer to a working eczema analysis with a PDF report. It covers two ways of using the project:

1. **Command line mode**: one command, one photo, one PDF report. Best for quick tests.
2. **Web application mode**: a full interface with sign in, upload, questionnaire, results and history.

## Part 1: Requirements

| Tool | Version | Why |
|---|---|---|
| Python | 3.10 or newer | Runs the detection, analysis and report pipeline |
| Node.js and npm | 18 or newer | Runs the React web application |
| Git | any recent version | Downloads the project |
| Gemini API key | free | Used by the Vision Language Model to write the report |
| Firebase project | free | Used for user accounts in the web application |

A graphics card is not required. YOLOv8 runs on the CPU, it is just a little slower.

## Part 2: Download the project

```bash
git clone https://github.com/achrefslim/Eczema_Detection_VLM.git
cd Eczema_Detection_VLM
```

## Part 3: Install the Python side

**Step 1.** (Recommended) create a virtual environment so the packages stay inside the project.

On Windows:

```bash
python -m venv venv
venv\Scripts\activate
```

On Linux or macOS:

```bash
python3 -m venv venv
source venv/bin/activate
```

**Step 2.** Install all the packages.

```bash
pip install -r requirements.txt
```

This installs YOLOv8 (Ultralytics), PyTorch, OpenCV, scikit image, the Gemini SDK, ReportLab, Flask and the other libraries. The first install can take a few minutes because PyTorch is large.

**Step 3.** Get a Gemini API key.

1. Go to [Google AI Studio](https://aistudio.google.com).
2. Sign in with a Google account.
3. Click **Get API key** then **Create API key**.
4. Copy the key.

**Step 4.** Put the key in a `.env` file.

Make a copy of `.env.example` and name it `.env`, then open it and replace the placeholder:

```
GEMINI_API_KEY=paste_your_key_here
GEMINI_API_KEY_BACKUP=
```

The second line is optional. If you have a second key, the system will use it automatically when the first one reaches its daily quota.

Never share the `.env` file and never upload it to GitHub. It is already listed in `.gitignore`.

## Part 4: Command line mode

This mode does not need the web application or Firebase.

**Step 1.** Prepare a clear photo of the skin area (JPG or PNG). Good light, sharp focus, and the lesion filling a good part of the picture give the best results.

**Step 2.** Run the master pipeline with the photo and a short description of the patient:

```bash
python master_pipeline.py --image my_photo.jpg --prompt "6 month old infant. Red patches on both cheeks. Itching worse at night. No prior treatment. Family history of asthma."
```

If the file name contains spaces, keep the quotes around it, for example `--image "hand photo.jpg"`.

**Step 3.** (Optional) change the detection sensitivity with `--conf`. The default is 0.25.

```bash
python master_pipeline.py --image hand.jpg --prompt "Child with hand eczema, scratching" --conf 0.3
```

| Value | Effect |
|:---:|---|
| 0.1 | Very sensitive, finds more regions but may include false ones |
| 0.25 | Default balance |
| 0.5 | Strict, keeps only very clear regions |

**Step 4.** Watch the console. You will see the two main stages:

1. `STEP 1/2 Running Pillar 2`: YOLO detection, segmentation and ABCDE metrics.
2. `STEP 2/2 Running Pillar 3`: Gemini writes the report and the PDF is built.

**Step 5.** Open the results.

| Where | What you get |
|---|---|
| `output/<date_time>/final_annotated.jpg` | Your photo with every detected region and its severity |
| `output/<date_time>/region_1_abcde_report.png` | ABCDE report card of region 1 |
| `output/<date_time>/region_1_processing_grid.png` | The image processing steps in nine panels |
| `output/<date_time>/abcde_report.json` | All metrics as JSON |
| `reports/dermatology_report_<date_time>.pdf` | The final medical report |

You can also run each pillar on its own:

```bash
python eczema_pipeline_v2.py --model best.pt --image my_photo.jpg --conf 0.25
```

```bash
python pillar3_report.py --json output/<date_time>/abcde_report.json --original my_photo.jpg --annotated output/<date_time>/final_annotated.jpg --pathology pathology.xlsx --prompt "Patient description"
```

## Part 5: Web application mode

The web application has two parts that run at the same time: the Flask backend (port 5000) and the React frontend (port 3000).

### 5.1 Create the Firebase project

1. Go to the [Firebase console](https://console.firebase.google.com) and click **Add project**.
2. Inside the project open **Build** then **Authentication**, click **Get started** and enable **Email/Password** (and **Google** if you want Google sign in).
3. Open **Build** then **Firestore Database** and create a database.
4. Open **Project settings**, scroll to **Your apps**, click the web icon and register an app.
5. Firebase shows a `firebaseConfig` object. Keep this page open.

### 5.2 Configure the frontend

Go into the `eczema-app` folder, make a copy of `.env.example` named `.env` and fill it with the values from the Firebase page:

```
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
REACT_APP_FIREBASE_APP_ID=...
```

### 5.3 Start the backend

Open a first terminal in the main project folder:

```bash
python backend_server.py
```

You should see `SkinSight AI Backend Server` and `http://localhost:5000`. You can check it is alive by opening http://localhost:5000/api/health in a browser.

### 5.4 Start the frontend

Open a second terminal:

```bash
cd eczema-app
npm install
npm start
```

The first `npm install` downloads all packages and takes a few minutes. Then the browser opens http://localhost:3000 automatically.

### 5.5 Use the application

**1. Create an account.** On the sign up page, enter your full name, email and a password of at least 6 characters. You can also sign in with Google if you enabled it.

**2. Dashboard.** After login you arrive on the dashboard. An interactive user guide can walk you through the interface the first time.

**3. Upload a photo.** Drag and drop a skin photo or click to choose one.

**4. Fill the patient questionnaire.** Enter the patient name, age, how long the problem has existed and a description of the symptoms (itching, location, triggers, previous treatments). The more precise the description, the better the report.

**5. Wait for the analysis.** The full pipeline runs on the server. It usually takes between 30 seconds and 2 minutes.

**6. Read the results.** The results page shows:

1. The original and the annotated photo side by side
2. The diagnosis and the eczema phase
3. The overall severity score and its label
4. The ABCDE metrics of every region
5. The treatment plan, lifestyle advice, when to see a doctor and the follow up schedule

**7. Download the PDF.** Click the download button to get the full dermatology report.

**8. History.** The **History** menu lists all your previous analyses. You can open, download or delete each one. When the same area is analysed again later, the Evolution (E) criterion compares it with the previous result.

**9. Settings.** Change your profile, switch between light and dark mode, change your password or delete your account.

## Part 6: Understanding the report

| Section | Meaning |
|---|---|
| Executive summary | Short overview in simple words |
| Visual analysis | What the model sees in the photos |
| ABCDE clinical analysis | Interpretation of the measured metrics |
| Diagnosis and differential | Most probable diagnosis and other conditions to consider |
| Eczema type and phase | Acute, subacute or chronic and the type of eczema |
| Severity assessment | Explanation of the 0 to 10 score |
| Treatment plan | Suggested care, what to do and what to avoid |
| Lifestyle and prevention | Daily habits that help |
| When to see a doctor | Warning signs |
| Follow up schedule | When to check again |

## Part 7: Troubleshooting

| Problem | Solution |
|---|---|
| `Image not found` | Check the path of the photo. Use quotes when the name has spaces. |
| `YOLO model not found: best.pt` | Run the command from the project folder where `best.pt` is located. |
| `GEMINI_API_KEY is not set` | Create the `.env` file from `.env.example` and add your key. |
| `Gemini quota exhausted` or both keys failed | Wait for the daily quota to reset or add a second key in `GEMINI_API_KEY_BACKUP`. |
| `No eczema detected` | Use a sharper photo with better light, or lower the threshold with `--conf 0.15`. |
| Web app shows a network error | Make sure `python backend_server.py` is running on port 5000. |
| Firebase error on login | Check every value in `eczema-app/.env`, then restart `npm start`. |
| Pipeline timed out | The first run downloads model files and can be slow. Try again. |

## Part 8: Customisation

The main settings are at the top of `master_pipeline.py`:

```python
YOLO_MODEL_PATH    = "best.pt"
PATHOLOGY_EXCEL    = "pathology.xlsx"
CONFIDENCE_THRESH  = 0.25
```

1. To use your own trained detector, replace `best.pt` with your YOLOv8 weights.
2. To enrich the medical knowledge given to the VLM, add rows to `pathology.xlsx`.
3. To change the Gemini model, edit `GEMINI_MODEL` at the top of `pillar3_report.py`.

## Reminder

SkinSight AI is a research and learning project. Its results are an aid and never a final medical diagnosis. Always consult a dermatologist.
