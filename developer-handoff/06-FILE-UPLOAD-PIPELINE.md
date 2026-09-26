# 06 · File Upload Pipeline

Code: `app/api/files.py`, `app/services/documents.py`, `app/services/storage.py`. Frontend: `src/services/resumeUpload.service.ts`, `import.service.ts` (`apiClient.upload`, 60 s timeout).

## Flow

```
POST /api/files/upload (multipart "file")
  → size check (MAX_UPLOAD_BYTES, 10 MB)        400 FILE_TOO_LARGE / EMPTY_FILE
  → type detection by magic bytes               400 UNSUPPORTED_FILE_TYPE
  → text extraction (pypdf / python-docx)       400 UNREADABLE_FILE
  → store bytes (bucket or MongoDB) + files record with extracted text
  ← {fileId, fileName, fileSize, fileType, status: "ready"}

POST /api/files/{fileId}/parse-resume   → AI → ResumeDocument for review (not saved)
POST /api/files/{fileId}/parse-profile  → AI → ProfileData draft for onboarding (not saved)

POST /api/resumes {sourceType: "upload", sourceFileId, ...}   → saves the reviewed resume (free, once per file)
DELETE /api/files/{fileId}                                     → removes record and stored bytes
```

## Validation (`services/documents.py`)

- Type comes from content, never the name or Content-Type: `%PDF-` → pdf; a ZIP containing `word/document.xml` → docx. Legacy `.doc` gets a specific "save as .docx or PDF" message.
- PDF: first 10 pages; empty-password encrypted PDFs are decrypted, others fail with `UNREADABLE_FILE`. DOCX: paragraphs plus table rows.
- Extracted text is capped at 60,000 characters.
- File names are reduced to the base name, unsafe characters replaced, max 200 chars.

## Storage (`services/storage.py`)

| Mode | When | Where |
|---|---|---|
| Bucket | `UPLOAD_BUCKET` set | Firebase/Cloud Storage bucket via `firebase-admin`, object `<UPLOAD_PREFIX>/<uid>/<fileId>`; the record holds `storage: "bucket"`, `objectName` |
| MongoDB | default | Bytes inline in the `files` record as `Binary` (`storage: "mongo"`) |

## Parsing

- Requires text or, for PDFs, the original bytes; otherwise `400 UNREADABLE_FILE`.
- If a PDF yields fewer than 200 characters of text (scanned/image PDF), the PDF itself is sent to the AI model.
- Parsing is an AI action (daily allowance, refunded on failure, `AI_RATE_LIMIT`). Uploading is not.
- `parse-resume` fills missing contact name/email from the account, normalizes through `ResumeDocumentIn`, and returns a heuristic ATS score.

## Saving uploads as resumes

Uploaded resumes are the user's own documents, so they don't consume a resume credit. `POST /api/resumes` with `sourceType: "upload"` must include `sourceFileId`; the file is atomically claimed (`resumeId` set). A second save of the same upload, or an expired upload, returns `409 CONFLICT`. If resume creation fails, the claim is released.

## Retention

- `files` records have a TTL index on `createdAt` of `UPLOAD_RETENTION_DAYS` (default 7 days). In MongoDB mode this deletes the bytes too.
- Bucket objects are deleted by `storage.cleanup_expired()`, which runs in the API maintenance loop (every `JOB_INGEST_INTERVAL_HOURS`, or every 12 h when that is 0) and in `python -m app.cli.ingest_jobs`.
- Saved resumes are independent documents and are not affected by upload expiry.
- `DELETE /api/me` deletes all of the user's files and bucket objects.
