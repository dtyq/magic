# Magic Service Infrastructure Module

This module provides abstraction for Magic Service API configuration and client management, designed to centralize and standardize Magic Service interactions across the application.

## Architecture

The module follows the same patterns as other infrastructure modules in the project:

- **config.py**: Configuration management with multiple source support
- **client.py**: API client for Magic Service interactions
- **exceptions.py**: Custom exception hierarchy
- **__init__.py**: Module exports

## Features

### Configuration Management

The `MagicServiceConfigLoader` supports multiple configuration sources with fallback strategy:

1. **Primary**: Credentials file (`magic_service_host`)
2. **Fallback**: Environment variables (`MAGIC_API_SERVICE_BASE_URL`)

#### Usage Examples

```python
from app.infrastructure.magic_service import MagicServiceConfigLoader

# Load with fallback strategy
config = MagicServiceConfigLoader.load_with_fallback(
    config_file="path/to/init_client_message.json"
)

# Load from configuration file only
config = MagicServiceConfigLoader.from_config_file(
    config_file="path/to/init_client_message.json"
)

# Load from environment variables only
config = MagicServiceConfigLoader.from_environment()
```

### API Client

The `MagicServiceClient` provides a clean interface for Magic Service API interactions:

```python
from app.infrastructure.magic_service import MagicServiceClient

client = MagicServiceClient(config)

# Register files
file_attachments = [
    {
        "file_key": "path/to/file.txt",
        "file_extension": "txt",
        "filename": "file.txt",
        "file_size": 1024,
        "external_url": "https://storage.example.com/file.txt",
        "sandbox_id": "sandbox_123"
    }
]

result = await client.register_files(file_attachments)
```

### Context Manager Support

The client supports async context manager for automatic session management:

```python
async with MagicServiceClient(config) as client:
    result = await client.register_files(file_attachments)
    # Session is automatically closed
```

## Configuration Sources

### Credentials File Format

```json
{
  "magic_service_host": "http://magic-service:9501",
  "sandbox_id": "optional_sandbox_id",
  "organization_code": "optional_org_code",
  "batch_id": "batch_identifier"
}
```

### Environment Variables

- `MAGIC_API_SERVICE_BASE_URL`: Magic Service API base URL
- `SUPER_MAGIC_SANDBOX_ID`: Default sandbox ID
- `SUPER_MAGIC_ORGANIZATION_CODE`: Default organization code
- `SUPER_MAGIC_TASK_ID`: Default task ID

## Exception Hierarchy

- `MagicServiceError`: Base exception
  - `ConfigurationError`: Configuration issues
  - `ApiError`: API request failures
  - `ConnectionError`: Connection problems

## Integration

This module is designed to replace scattered Magic Service API handling throughout the application. Key integration points:

1. **Storage Uploader Tool**: File registration after upload
2. **Future API clients**: Standardized Magic Service interactions
3. **Configuration management**: Centralized config loading

## Migration from Legacy Code

Old pattern:
```python
api_base_url = os.getenv("MAGIC_API_SERVICE_BASE_URL")
# Manual URL formatting
# Direct aiohttp usage
```

New pattern:
```python
from app.infrastructure.magic_service import MagicServiceConfigLoader, MagicServiceClient

config = MagicServiceConfigLoader.load_with_fallback()
client = MagicServiceClient(config)
result = await client.register_files(files)
```

## Benefits

1. **Centralized Configuration**: Single source of truth for Magic Service config
2. **Fallback Strategy**: Graceful degradation between config sources
3. **Error Handling**: Structured exception hierarchy
4. **Reusability**: Standard interface for all Magic Service interactions
5. **Testability**: Easy to mock and test
6. **Maintainability**: Clear separation of concerns
