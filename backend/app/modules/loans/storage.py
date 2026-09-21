import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings


class DocumentStorage:
    @property
    def base_dir(self) -> Path:
        return Path(get_settings().upload_dir)

    @property
    def max_bytes(self) -> int:
        return get_settings().max_upload_size_mb * 1024 * 1024

    allowed_mime_types = {
            "application/pdf",
            "image/jpeg",
            "image/jpg",
            "image/png",
        }

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

        ext = Path(upload.filename or "file").suffix.lower() or ".bin"
        file_key = f"{document_type}/{uuid.uuid4().hex}{ext}"
        dest = self._application_dir(application_id) / file_key
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)

        return file_key, upload.filename or dest.name, upload.content_type or "application/octet-stream", size

    def resolve_path(self, application_id: str, file_key: str) -> Path:
        path = (self._application_dir(application_id) / file_key).resolve()
        base = self._application_dir(application_id).resolve()
        if not str(path).startswith(str(base)) or not path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
        return path
