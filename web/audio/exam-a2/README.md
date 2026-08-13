# DUVELA EXAM · Deutsch A2 audio

`elevenlabs-scripts.txt` contains all 75 original German scripts and their required MP3 paths.

Create the files inside `mt1` through `mt5` using the exact names from the manifest. You can also place all 75 MP3 files in one folder and import them with:

```powershell
npm run import:exam-a2-audio -- "C:\path\to\your\folder" A2
```

The importer verifies every filename and MP3 before copying. Until the MP3 files are added, the exam uses German browser speech as a temporary fallback.
