"""Visual understanding utilities package."""

# Models and enums
from .models import (
    ImageDownloadStatus,
    ImageDownloadResult,
    CopiedFileInfo,
    ImageProcessResult,
    ImageData,
    ImageDimensionInfo,
    SingleImageResult,
    BatchImageProcessingResults,
)

# Image processor
from .image_processor import ImageProcessor

# Image format utilities
from .image_format_utils import (
    validate_image_signature,
    detect_content_type_from_file,
    get_content_type_for_local_file,
    FORMATS_NEED_CONVERSION,
)

# Image info utilities
from .image_info_utils import (
    get_image_dimensions,
    calculate_and_format_aspect_ratio,
)

# Image conversion utilities
from .image_conversion_utils import (
    local_file_to_base64,
    convert_unsupported_format_to_jpeg,
)

# Image compression utilities
from .image_compress_utils import (
    should_compress_image,
    compress_image,
    compress_if_needed,
)

# Format utilities
from .format_utils import (
    format_file_size,
    extract_image_source_name,
    build_dimension_info_text,
    format_image_dimensions_info,
    format_download_info_for_content,
)

# File operations utilities
from .file_operations_utils import (
    get_workspace_path,
    is_file_in_workspace,
    copy_file_to_visual_dir,
    generate_file_download_url,
    cleanup_copied_files,
    create_temp_directory,
    cleanup_temp_directory,
)

# LLM request utilities
from .llm_request_utils import (
    LLMRequestHandler,
    DEFAULT_SYSTEM_PROMPT,
)

__all__ = [
    # Models
    'ImageDownloadStatus',
    'ImageDownloadResult',
    'CopiedFileInfo',
    'ImageProcessResult',
    'ImageData',
    'ImageDimensionInfo',
    'SingleImageResult',
    'BatchImageProcessingResults',
    # Image processor
    'ImageProcessor',
    # Image format
    'validate_image_signature',
    'detect_content_type_from_file',
    'get_content_type_for_local_file',
    'FORMATS_NEED_CONVERSION',
    # Image info
    'get_image_dimensions',
    'calculate_and_format_aspect_ratio',
    # Image conversion
    'local_file_to_base64',
    'convert_unsupported_format_to_jpeg',
    # Image compression
    'should_compress_image',
    'compress_image',
    'compress_if_needed',
    # Format
    'format_file_size',
    'extract_image_source_name',
    'build_dimension_info_text',
    'format_image_dimensions_info',
    'format_download_info_for_content',
    # File operations
    'get_workspace_path',
    'is_file_in_workspace',
    'copy_file_to_visual_dir',
    'generate_file_download_url',
    'cleanup_copied_files',
    'create_temp_directory',
    'cleanup_temp_directory',
    # LLM request
    'LLMRequestHandler',
    'DEFAULT_SYSTEM_PROMPT',
]
