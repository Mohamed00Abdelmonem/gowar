import re

_ARABIC_INDIC_MAP = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
_EGYPT_E164_RE = re.compile(r"^\+201[0125]\d{8}$")


def normalize_phone_number(raw: str | None, default_country: str = "EG") -> str:
    """
    Normalize a mobile phone number into canonical E.164 format (+201XXXXXXXXX for Egypt).
    Supports Arabic-Indic digits, spaces/dashes, local 01XXXXXXXXX, 201XXXXXXXXX,
    00201XXXXXXXXX, and +201XXXXXXXXX. Raises ValueError if invalid or ambiguous.
    """
    if raw is None:
        raise ValueError("رقم الموبايل مطلوب.")
    cleaned = raw.translate(_ARABIC_INDIC_MAP).strip()
    if not cleaned:
        raise ValueError("رقم الموبايل مطلوب.")

    # Strip formatting characters while preserving a leading '+' if present
    has_plus = cleaned.startswith("+")
    digits = re.sub(r"[^\d]", "", cleaned)
    if not digits:
        raise ValueError("صيغة رقم الموبايل غير صحيحة.")

    if default_country == "EG":
        if has_plus:
            candidate = f"+{digits}"
        elif digits.startswith("0020"):
            candidate = f"+20{digits[4:]}"
        elif digits.startswith("20") and len(digits) == 12:
            candidate = f"+{digits}"
        elif digits.startswith("01") and len(digits) == 11:
            candidate = f"+2{digits}"
        elif digits.startswith("1") and len(digits) == 10:
            candidate = f"+20{digits}"
        else:
            raise ValueError(
                "يرجى إدخال رقم موبايل مصري صحيح (مثال: 01012345678 أو +201012345678)."
            )

        if not _EGYPT_E164_RE.match(candidate):
            raise ValueError(
                "يرجى إدخال رقم موبايل مصري صحيح يبدأ بـ 010 أو 011 أو 012 أو 015."
            )
        return candidate

    raise ValueError(f"Unsupported country code: {default_country}")


def try_normalize_phone_number(raw: str | None, default_country: str = "EG") -> str | None:
    try:
        return normalize_phone_number(raw, default_country=default_country)
    except ValueError:
        return None
