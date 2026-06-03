import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


HOST = os.getenv("PDF_EXTRACT_HOST", "127.0.0.1")
PORT = int(os.getenv("PDF_EXTRACT_PORT", "5051"))
MAX_REQUEST_BYTES = int(os.getenv("PDF_EXTRACT_MAX_BYTES", str(100 * 1024 * 1024)))


def clean_text(text):
    return " ".join((text or "").split())


def extract_with_pymupdf(pdf_bytes, max_pages=None):
    import fitz # pyright: ignore[reportMissingImports]

    pages = []
    with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
        total_pages = len(document)
        page_limit = total_pages if not max_pages else min(total_pages, max_pages)
        for page_index in range(page_limit):
            pages.append(document.load_page(page_index).get_text("text"))
    return clean_text(" ".join(pages))


def extract_with_pypdf(pdf_bytes, max_pages=None):
    from io import BytesIO
    from pypdf import PdfReader # type: ignore

    reader = PdfReader(BytesIO(pdf_bytes))
    page_limit = len(reader.pages) if not max_pages else min(len(reader.pages), max_pages)
    pages = []
    for page_index in range(page_limit):
        pages.append(reader.pages[page_index].extract_text() or "")
    return clean_text(" ".join(pages))


def extract_pdf_text(pdf_bytes, max_pages=None):
    engines = [
        ("pymupdf", extract_with_pymupdf),
        ("pypdf", extract_with_pypdf),
    ]
    errors = []

    for engine_name, extractor in engines:
        try:
            text = extractor(pdf_bytes, max_pages=max_pages)
            if text:
                return {"engine": engine_name, "text": text}
            errors.append(f"{engine_name}: empty text")
        except ModuleNotFoundError:
            errors.append(f"{engine_name}: not installed")
        except Exception as error:
            errors.append(f"{engine_name}: {error}")

    raise RuntimeError("; ".join(errors) or "No PDF engine available")


def run_cli():
    max_pages = None
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        max_pages = int(sys.argv[1])

    pdf_bytes = sys.stdin.buffer.read()
    if not pdf_bytes:
        raise RuntimeError("PDF body is required")

    result = extract_pdf_text(pdf_bytes, max_pages=max_pages)
    sys.stdout.write(
        json.dumps(
            {
                "text": result["text"],
                "chars": len(result["text"]),
                "engine": result["engine"],
                "maxPages": max_pages,
            }
        )
    )


class PdfExtractHandler(BaseHTTPRequestHandler):
    server_version = "QuizzyPdfService/1.0"

    def do_GET(self):
        if self.path == "/":
            self._send_json(
                200,
                {
                    "ok": True,
                    "service": "pdf-extractor",
                    "endpoints": {
                        "health": "/health",
                        "extract": "/extract"
                    }
                }
            )
            return
        if self.path != "/health":
            self.send_error(404, "Not Found")
            return
        self._send_json(200, {"ok": True, "service": "pdf-extractor"})

    def do_POST(self):
        if self.path != "/extract":
            self.send_error(404, "Not Found")
            return

        content_length = int(self.headers.get("Content-Length", "0") or "0")
        if content_length <= 0:
            self._send_json(400, {"error": "PDF body is required"})
            return
        if content_length > MAX_REQUEST_BYTES:
            self._send_json(413, {"error": "PDF body exceeds maximum size"})
            return

        max_pages_header = self.headers.get("X-Max-Pages", "").strip()
        max_pages = int(max_pages_header) if max_pages_header.isdigit() else None

        try:
            pdf_bytes = self.rfile.read(content_length)
            result = extract_pdf_text(pdf_bytes, max_pages=max_pages)
            self._send_json(
                200,
                {
                    "text": result["text"],
                    "chars": len(result["text"]),
                    "engine": result["engine"],
                    "maxPages": max_pages,
                },
            )
        except Exception as error:
            self._send_json(500, {"error": str(error)})

    def log_message(self, format, *args):
        return

    def _send_json(self, status_code, payload):
        response = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--serve":
        server = ThreadingHTTPServer((HOST, PORT), PdfExtractHandler)
        print(f"PDF extraction service running on http://{HOST}:{PORT}")
        server.serve_forever()
    else:
        run_cli()
