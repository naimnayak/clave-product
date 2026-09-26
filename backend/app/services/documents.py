"""Upload validation (magic bytes, size) and text extraction for PDF and DOCX resumes."""

import io
import logging
import zipfile

from docx import Document
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from app.core.errors import ApiError

logger = logging.getLogger(__name__)
MAX_TEXT_CHARS = 60_000


def detect_file_type(data: bytes, file_name: str) -> str:
    """Returns "pdf" or "docx" based on the file's content, never on its name or Content-Type alone."""
    if data.startswith(b"%PDF-"):
        return "pdf"
    if data.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                if "word/document.xml" in archive.namelist():
                    return "docx"
        except zipfile.BadZipFile:
            pass
    extension = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    hint = " Legacy .doc files are not supported; save it as .docx or PDF." if extension == "doc" else ""
    raise ApiError(400, "UNSUPPORTED_FILE_TYPE", f"Please upload a PDF or DOCX file.{hint}")


def extract_text(data: bytes, file_type: str) -> str:
    try:
        text = _pdf_text(data) if file_type == "pdf" else _docx_text(data)
    except (PdfReadError, zipfile.BadZipFile, KeyError, ValueError) as exc:
        logger.info("Could not read uploaded %s: %s", file_type, exc)
        raise ApiError(400, "UNREADABLE_FILE", "We couldn't read this file. Try exporting it again as PDF or DOCX.") from exc
    return text[:MAX_TEXT_CHARS]


def _pdf_text(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception as exc:  # pypdf raises several types for bad passwords
            raise ApiError(400, "UNREADABLE_FILE", "This PDF is password protected. Remove the password and try again.") from exc
    return "\n".join((page.extract_text() or "") for page in reader.pages[:10]).strip()


def _docx_text(data: bytes) -> str:
    document = Document(io.BytesIO(data))
    lines = [p.text for p in document.paragraphs if p.text.strip()]
    for table in document.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                lines.append(" | ".join(dict.fromkeys(cells)))
    return "\n".join(lines).strip()
