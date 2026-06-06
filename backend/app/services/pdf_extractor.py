"""PDF text extraction.

Pulls plain text out of a PDF byte stream with pdfplumber. Pure function, no
I/O beyond the in-memory bytes it's handed — the caller fetches the file from
storage. Raises `PdfExtractionError` on any failure (corrupt file, no
extractable text) so the analysis pipeline can mark the contract `failed`
rather than crash.
"""

import io
import logging

import pdfplumber

logger = logging.getLogger(__name__)


class PdfExtractionError(Exception):
    """Raised when a PDF cannot be opened or yields no usable text."""


def extract_text(pdf_bytes: bytes) -> str:
    """Extract and return the plain text of a PDF given its raw bytes.

    Page text is joined with blank lines between pages. Pages that yield no text
    (e.g. scanned images) contribute nothing rather than failing the whole
    document. Raises `PdfExtractionError` if the PDF can't be parsed or contains
    no extractable text at all.
    """
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
    except Exception as exc:  # noqa: BLE001 — any parse failure becomes our error type
        logger.exception("Failed to open or read PDF")
        raise PdfExtractionError("Could not read the PDF file.") from exc

    text = "\n\n".join(part for part in pages if part).strip()
    if not text:
        # Likely a scanned/image-only PDF — there is nothing to analyze.
        raise PdfExtractionError(
            "No extractable text found in the PDF (it may be a scanned image)."
        )
    return text
