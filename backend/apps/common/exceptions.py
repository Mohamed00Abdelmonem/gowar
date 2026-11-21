from rest_framework.views import exception_handler


def _extract_detail(data) -> str:
    if isinstance(data, list) and data:
        return str(data[0])
    if isinstance(data, dict):
        if "detail" in data and data["detail"]:
            return str(data["detail"])
        if "non_field_errors" in data and data["non_field_errors"]:
            val = data["non_field_errors"]
            return str(val[0]) if isinstance(val, list) else str(val)
        for key, val in data.items():
            if isinstance(val, list) and val:
                return f"{key}: {val[0]}" if key != "non_field_errors" else str(val[0])
            if isinstance(val, str) and val:
                return f"{key}: {val}"
    return "Request failed."


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    payload = {
        "error": True,
        "status_code": response.status_code,
        "detail": _extract_detail(response.data),
        "errors": response.data,
    }
    response.data = payload
    return response
