import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode


class DocumentStorage:
    @property
    def base_dir(self) -> Path:
        return Path(get_settings().upload_dir)

    @property
    def max_bytes(self) -> int:
        return get_settings().max_upload_size_mb * 1024 * 1024

    # Detected type → (canonical mime, stored extension). Detection uses the
    # file's own magic bytes; the client-declared Content-Type and filename are
    # not trusted (an HTML/script file labelled application/pdf used to be
    # accepted and later served back to staff with that label).
    _SIGNATURES: tuple[tuple[bytes, str, str], ...] = (
        (b"%PDF-", "application/pdf", ".pdf"),
        (bytes.fromhex("ffd8ff"), "image/jpeg", ".jpg"),
        (bytes.fromhex("89504e470d0a1a0a"), "image/png", ".png"),
    )
    _DECLARED_ALIASES = {"image/jpg": "image/jpeg", "image/pjpeg": "image/jpeg"}

    allowed_mime_types = {"application/pdf", "image/jpeg", "image/jpg", "image/png"}

    @classmethod
    def detect(cls, raw: bytes) -> tuple[str, str] | None:
        for magic, mime, ext in cls._SIGNATURES:
            if raw.startswith(magic):
                return mime, ext
        return None

    def _application_dir(self, application_id: str) -> Path:
        path = self.base_dir / "loan_applications" / application_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    async def save(
        self,
        *,
        application_id: str,
        document_type: str,
        upload: UploadFile,
    ) -> tuple[str, str, str, int]:
        if upload.content_type not in self.allowed_mime_types:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Only PDF, JPG, and PNG files are allowed",
            )

        raw = await upload.read()
        size = len(raw)
        if size == 0:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Empty file")
        if size > self.max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds {get_settings().max_upload_size_mb}MB limit",
            )

        detected = self.detect(raw)
        declared = self._DECLARED_ALIASES.get(upload.content_type or "", upload.content_type)
        if detected is None or detected[0] != declared:
            raise AppError(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                ErrorCode.DOCUMENT_INVALID,
                "File content is not a valid PDF, JPG or PNG, or does not match its type.",
            )
        mime_type, ext = detected

        file_key = f"{document_type}/{uuid.uuid4().hex}{ext}"
        dest = self._application_dir(application_id) / file_key
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)

        display_name = Path(upload.filename or "").name[:200] or f"{document_type}{ext}"
        return file_key, display_name, mime_type, size

    def resolve_path(self, application_id: str, file_key: str) -> Path:
        path = (self._application_dir(application_id) / file_key).resolve()
        base = self._application_dir(application_id).resolve()
        if not str(path).startswith(str(base)) or not path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
        return path
