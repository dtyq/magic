"""
LLM SDK 接口

提供 OpenAI 客户端工厂函数，api_key 和 base_url 未传时自动从
.credentials/init_client_message.json 读取。

- create_openai_client()       异步版本，返回 AsyncOpenAI，用于 async 上下文
- create_openai_sync_client()  同步版本，返回 OpenAI，用于普通脚本
- file_to_url()                将工作区文件转换为临时下载 URL（调用主进程接口）
- image_to_base64()            将本地图片文件转换为 base64 data URL，file_to_url 失败时的备选
"""
import base64
import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import aiofiles
from openai import AsyncOpenAI, OpenAI

# 常见图片扩展名到 MIME 类型的映射
_MIME_TYPES = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
    "bmp": "image/bmp",
    "tiff": "image/tiff",
    "tif": "image/tiff",
    "avif": "image/avif",
}


def _find_project_root() -> Path:
    """从当前工作目录向上查找项目根目录。

    判断依据：目录下存在 .credentials/ 子目录。
    与 agentlang PathManager 的逻辑一致，仅使用 stdlib。

    Returns:
        项目根目录路径

    Raises:
        RuntimeError: 找不到包含 .credentials/ 的目录时抛出
    """
    current = Path.cwd()
    for directory in [current, *current.parents]:
        if (directory / ".credentials").is_dir():
            return directory
    raise RuntimeError(
        f"无法定位项目根目录：从 {current} 向上遍历未找到包含 .credentials/ 的目录"
    )


def _parse_credentials(data: dict, credentials_path: Path) -> Tuple[str, str]:
    """从已解析的 JSON 数据中提取 base_url 和 api_key。"""
    magic_service_host = data.get("magic_service_host")
    if not magic_service_host:
        raise RuntimeError(
            f"凭证文件缺少 'magic_service_host' 字段: {credentials_path}"
        )
    base_url = magic_service_host.rstrip("/") + "/v1"

    metadata = data.get("metadata")
    if not isinstance(metadata, dict):
        raise RuntimeError(
            f"凭证文件缺少 'metadata' 字段或格式错误: {credentials_path}"
        )

    api_key = metadata.get("authorization")
    if not api_key:
        raise RuntimeError(
            f"凭证文件缺少 'metadata.authorization' 字段: {credentials_path}"
        )

    return base_url, api_key


async def _resolve_credentials() -> Tuple[str, str]:
    """从 .credentials/init_client_message.json 异步读取 base_url 和 api_key。"""
    project_root = _find_project_root()
    credentials_path = project_root / ".credentials" / "init_client_message.json"

    if not credentials_path.exists():
        raise RuntimeError(f"凭证文件不存在: {credentials_path}")

    try:
        async with aiofiles.open(credentials_path, "r", encoding="utf-8") as f:
            content = await f.read()
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"凭证文件 JSON 解析失败: {credentials_path}: {e}") from e

    return _parse_credentials(data, credentials_path)


def _resolve_credentials_sync() -> Tuple[str, str]:
    """从 .credentials/init_client_message.json 同步读取 base_url 和 api_key。"""
    project_root = _find_project_root()
    credentials_path = project_root / ".credentials" / "init_client_message.json"

    if not credentials_path.exists():
        raise RuntimeError(f"凭证文件不存在: {credentials_path}")

    try:
        with open(credentials_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"凭证文件 JSON 解析失败: {credentials_path}: {e}") from e

    return _parse_credentials(data, credentials_path)


async def create_openai_client(
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    timeout: Optional[float] = None,
    max_retries: int = 0,
    default_headers: Optional[Dict[str, str]] = None,
    **kwargs,
) -> AsyncOpenAI:
    """创建 AsyncOpenAI 客户端实例。

    api_key 和 base_url 未传时，自动异步读取
    .credentials/init_client_message.json：
    - base_url  <- magic_service_host
    - api_key   <- metadata.authorization

    Args:
        api_key: OpenAI API Key，不填则从凭证文件读取。
        base_url: API Base URL，不填则从凭证文件读取。
        timeout: 请求超时秒数，None 表示使用 openai 默认值。
        max_retries: 请求失败重试次数，默认 0。
        default_headers: 附加到每个请求的默认请求头。
        **kwargs: 其余参数原样透传给 AsyncOpenAI。

    Returns:
        AsyncOpenAI 客户端实例。

    Raises:
        RuntimeError: 凭证文件不存在或字段缺失时抛出。

    Examples:
        # 使用凭证文件中的配置
        client = await create_openai_client()

        # 覆盖部分参数
        client = await create_openai_client(timeout=30.0, max_retries=0)

        # 完全自定义（不读取凭证文件）
        client = await create_openai_client(
            api_key="sk-xxx",
            base_url="https://api.openai.com/v1",
        )

        # 使用客户端
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "hello"}],
        )
    """
    auto_headers: Dict[str, str] = {}

    if api_key is None or base_url is None:
        try:
            resolved_base_url, resolved_api_key = await _resolve_credentials()
        except RuntimeError as e:
            raise RuntimeError(
                f"无法自动获取凭证，请手动传入 api_key 和 base_url 参数。原因: {e}"
            ) from e

        if api_key is None:
            # 凭证文件中的 authorization 通过 user-authorization 头传递
            auto_headers["user-authorization"] = resolved_api_key
            api_key = "placeholder"
        if base_url is None:
            base_url = resolved_base_url

    merged_headers = {**auto_headers, **(default_headers or {})}

    client_kwargs: Dict[str, Any] = {
        "api_key": api_key,
        "base_url": base_url,
        "max_retries": max_retries,
    }

    if timeout is not None:
        client_kwargs["timeout"] = timeout

    if merged_headers:
        client_kwargs["default_headers"] = merged_headers

    client_kwargs.update(kwargs)

    return AsyncOpenAI(**client_kwargs)


def create_openai_sync_client(
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    timeout: Optional[float] = None,
    max_retries: int = 0,
    default_headers: Optional[Dict[str, str]] = None,
    **kwargs,
) -> OpenAI:
    """创建同步 OpenAI 客户端实例，适用于普通脚本（无 async 上下文）。

    api_key 和 base_url 未传时，自动从
    .credentials/init_client_message.json 读取：
    - base_url  <- magic_service_host + /v1
    - api_key   <- metadata.authorization

    Args:
        api_key: OpenAI API Key，不填则从凭证文件读取。
        base_url: API Base URL，不填则从凭证文件读取。
        timeout: 请求超时秒数，None 表示使用 openai 默认值。
        max_retries: 请求失败重试次数，默认 0。
        default_headers: 附加到每个请求的默认请求头。
        **kwargs: 其余参数原样透传给 OpenAI。

    Returns:
        OpenAI 同步客户端实例。

    Raises:
        RuntimeError: 凭证文件不存在或字段缺失时抛出。

    Examples:
        client = create_openai_sync_client()
        models = client.models.list()
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": "hello"}],
        )
    """
    auto_headers: Dict[str, str] = {}

    if api_key is None or base_url is None:
        try:
            resolved_base_url, resolved_api_key = _resolve_credentials_sync()
        except RuntimeError as e:
            raise RuntimeError(
                f"无法自动获取凭证，请手动传入 api_key 和 base_url 参数。原因: {e}"
            ) from e

        if api_key is None:
            # 凭证文件中的 authorization 通过 user-authorization 头传递
            auto_headers["user-authorization"] = resolved_api_key
            api_key = "placeholder"
        if base_url is None:
            base_url = resolved_base_url

    merged_headers = {**auto_headers, **(default_headers or {})}

    client_kwargs: Dict[str, Any] = {
        "api_key": api_key,
        "base_url": base_url,
        "max_retries": max_retries,
    }

    if timeout is not None:
        client_kwargs["timeout"] = timeout

    if merged_headers:
        client_kwargs["default_headers"] = merged_headers

    client_kwargs.update(kwargs)

    return OpenAI(**client_kwargs)


def file_to_url(file_path: str, expires_in: int = 3600) -> str:
    """将工作区文件转换为临时下载 URL。

    通过调用主进程的 /api/file/download-url 接口生成临时 CDN 链接，
    支持图片、PDF、音频等任意文件类型。

    如果传入的已是 http/https URL，则原样返回，不发起请求。

    Args:
        file_path: 工作区内的文件相对路径，例如 "workspace/images/photo.png"。
                   或 http/https URL（直接返回）。
        expires_in: URL 有效期（秒），默认 3600（1 小时）。

    Returns:
        临时下载 URL 字符串。

    Raises:
        RuntimeError: HTTP 请求失败或主进程未返回有效 URL 时抛出。

    Examples:
        url = file_to_url("workspace/images/photo.png")
        # 在 LLM messages 中使用：
        messages = [{"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": url}},
            {"type": "text", "text": "描述这张图片"},
        ]}]
    """
    if file_path.startswith("http://") or file_path.startswith("https://"):
        return file_path

    api_port = os.getenv("SUPER_MAGIC_API_PORT", "8002")
    url = f"http://127.0.0.1:{api_port}/api/file/download-url"

    payload = json.dumps({"file_path": file_path, "expires_in": expires_in}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"获取文件下载 URL 失败，HTTP {e.code}: {e.reason}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"无法连接主进程，请确认服务已启动: {e.reason}") from e

    if result.get("code") != 1000:
        raise RuntimeError(f"获取文件下载 URL 失败: {result.get('message', '未知错误')}")

    download_url = result.get("data", {}).get("download_url")
    if not download_url:
        raise RuntimeError(f"主进程未返回有效的 download_url，响应: {result}")

    return download_url


def image_to_base64(file_path: str) -> str:
    """将本地图片文件转换为 base64 data URL。优先使用 file_to_url，该函数作为备选方案。

    如果传入的是 http/https URL，则原样返回，不做任何处理。

    Args:
        file_path: 本地图片文件路径，或 http/https URL。

    Returns:
        base64 data URL 字符串（格式：data:{mime};base64,{data}），
        或原始 URL（如果输入已是 http/https 链接）。

    Raises:
        FileNotFoundError: 文件不存在时抛出。
        ValueError: 文件扩展名无法识别为图片格式时抛出。

    Examples:
        url = image_to_base64("test/screenshot.png")   # 相对路径基于 .workspace/ 解析
        url = image_to_base64("/abs/path/to/img.png")  # 绝对路径直接使用
        # 在 LLM messages 中使用：
        messages = [{"role": "user", "content": [
            {"type": "image_url", "image_url": {"url": url}},
            {"type": "text", "text": "描述这张图片"},
        ]}]
    """
    if file_path.startswith("http://") or file_path.startswith("https://"):
        return file_path

    path = Path(file_path)
    # 相对路径优先基于 workspace 目录解析
    if not path.is_absolute():
        workspace_path = _find_project_root() / ".workspace" / file_path
        if workspace_path.exists():
            path = workspace_path
    if not path.exists():
        raise FileNotFoundError(f"图片文件不存在: {file_path}")

    ext = path.suffix.lower().lstrip(".")
    mime_type = _MIME_TYPES.get(ext)
    if not mime_type:
        raise ValueError(f"不支持的图片格式: {ext}，支持格式: {', '.join(_MIME_TYPES)}")

    data = path.read_bytes()
    b64 = base64.b64encode(data).decode("utf-8")
    return f"data:{mime_type};base64,{b64}"


__all__ = [
    "create_openai_client",
    "create_openai_sync_client",
    "file_to_url",
    "image_to_base64",
]
