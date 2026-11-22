from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError

MAX_PROMOTION_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}


def validate_promotion_image(uploaded_file) -> None:
    if not uploaded_file:
        return
    if getattr(uploaded_file, "size", 0) > MAX_PROMOTION_IMAGE_BYTES:
        raise ValidationError("Banner image size must not exceed 5 MB.")

    pos = uploaded_file.tell() if hasattr(uploaded_file, "tell") else None
    try:
        img = Image.open(uploaded_file)
        img.verify()
        if (img.format or "").upper() not in ALLOWED_IMAGE_FORMATS:
            raise ValidationError(
                "Unsupported image format. Allowed formats: JPEG, PNG, WEBP."
            )
    except ValidationError:
        raise
    except (UnidentifiedImageError, OSError, Exception) as exc:
        raise ValidationError("Invalid or corrupted image file.") from exc
    finally:
        if pos is not None and hasattr(uploaded_file, "seek"):
            uploaded_file.seek(pos)
