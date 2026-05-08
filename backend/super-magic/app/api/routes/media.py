"""Media preview routes used by the local debug client."""

import asyncio
import ipaddress
import socket
from io import BytesIO
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from PIL import Image

from agentlang.logger import get_logger

try:
    import pillow_heif

    pillow_heif.register_heif_opener()
    import pillow_heif.AvifImagePlugin  # noqa: F401
except ImportError:
    pillow_heif = None

router = APIRouter(prefix="/v1/media", tags=["媒体预览"])
logger = get_logger(__name__)

MAX_PREVIEW_IMAGE_BYTES = 12 * 1024 * 1024
BROWSER_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/avif",
    "image/bmp",
}
CONVERTIBLE_IMAGE_TYPES = {
    "image/heic",
    "image/heif",
    "image/tiff",
}


def _content_type(value: str | None) -> str:
    if not value:
        return ""
    return value.split(";", 1)[0].strip().lower()


def _parse_preview_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Only HTTP(S) image URLs are supported")
    return url


async def _ensure_public_host(hostname: str) -> None:
    if hostname.lower() in {"localhost"}:
        raise HTTPException(status_code=400, detail="Local preview URLs are not allowed")

    try:
        infos = await asyncio.to_thread(socket.getaddrinfo, hostname, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail="Image host cannot be resolved") from exc

    for info in infos:
        address = info[4][0]
        try:
            ip = ipaddress.ip_address(address)
        except ValueError:
            continue
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
            raise HTTPException(status_code=400, detail="Private preview URLs are not allowed")


async def _fetch_preview_image(url: str) -> tuple[bytes, str]:
    current_url = _parse_preview_url(url)
    headers = {
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 SuperMagic-Debug-Client",
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(12.0, read=20.0)) as client:
        for _ in range(5):
            parsed = urlparse(current_url)
            await _ensure_public_host(parsed.hostname or "")

            async with client.stream("GET", current_url, headers=headers, follow_redirects=False) as response:
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        raise HTTPException(status_code=502, detail="Image redirect is missing location")
                    current_url = urljoin(str(response.url), location)
                    continue

                if response.status_code >= 400:
                    raise HTTPException(status_code=response.status_code, detail="Image request failed")

                declared_length = response.headers.get("content-length")
                declared_size = int(declared_length) if declared_length and declared_length.isdigit() else 0
                if declared_size > MAX_PREVIEW_IMAGE_BYTES:
                    raise HTTPException(status_code=413, detail="Image is too large to preview")

                chunks: list[bytes] = []
                total = 0
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > MAX_PREVIEW_IMAGE_BYTES:
                        raise HTTPException(status_code=413, detail="Image is too large to preview")
                    chunks.append(chunk)

                return b"".join(chunks), _content_type(response.headers.get("content-type"))

    raise HTTPException(status_code=508, detail="Image redirect chain is too long")


async def _convert_image_to_jpeg_async(content: bytes) -> bytes:
    return await asyncio.to_thread(_convert_image_to_jpeg_sync, content)


def _convert_image_to_jpeg_sync(content: bytes) -> bytes:
    with Image.open(BytesIO(content)) as image:
        image.load()
        if image.mode in {"RGBA", "LA", "P"}:
            converted = Image.new("RGB", image.size, (255, 255, 255))
            if image.mode == "P":
                image = image.convert("RGBA")
            converted.paste(image, mask=image.split()[-1] if image.mode in {"RGBA", "LA"} else None)
            image = converted
        elif image.mode != "RGB":
            image = image.convert("RGB")

        output = BytesIO()
        image.save(output, format="JPEG", quality=88, optimize=True)
        return output.getvalue()


@router.get("/image-preview")
async def preview_remote_image(url: str = Query(..., min_length=1)) -> Response:
    """Fetch a remote image and convert browser-unfriendly formats for inline preview."""
    content, media_type = await _fetch_preview_image(url)
    response_headers = {
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": 'inline; filename="preview-image"',
    }

    if media_type in BROWSER_IMAGE_TYPES:
        return Response(content=content, media_type=media_type, headers=response_headers)

    if media_type in CONVERTIBLE_IMAGE_TYPES or not media_type:
        try:
            converted = await _convert_image_to_jpeg_async(content)
        except Exception as exc:
            logger.warning(f"图片预览格式转换失败: {exc}")
            raise HTTPException(status_code=415, detail="Image format cannot be previewed") from exc
        return Response(content=converted, media_type="image/jpeg", headers=response_headers)

    raise HTTPException(status_code=415, detail="Unsupported image content type")
