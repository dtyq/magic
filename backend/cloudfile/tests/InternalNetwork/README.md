# Internal Network Tests

## Overview

This directory contains tests for internal network endpoint functionality. These tests are **excluded from the default test suite** and require special network conditions to run properly.

## Prerequisites

### Network Requirements
- **Alibaba Cloud ECS**: For OSS internal endpoint tests, your application must be running on Alibaba Cloud ECS instances
- **ByteDance Cloud ECS**: For TOS internal endpoint tests, your application must be running on ByteDance Cloud ECS instances
- **Internal DNS**: Internal endpoints require proper DNS resolution within the cloud provider's network
- **Security Groups**: Ensure your security groups allow outbound traffic to internal endpoints

### Configuration Requirements
- Valid cloud storage configurations in your test environment
- Valid FileService tokens (for FileService tests)
- Proper network connectivity to internal endpoints

## Running Internal Network Tests

### Run All Internal Network Tests
```bash
./vendor/bin/phpunit -c phpunit-internal.xml.dist
```

### Run Tests by Platform
```bash
# OSS internal endpoint tests
./vendor/bin/phpunit tests/InternalNetwork/OSS/

# TOS internal endpoint tests
./vendor/bin/phpunit tests/InternalNetwork/TOS/

# FileService internal endpoint tests
./vendor/bin/phpunit tests/InternalNetwork/FileService/

# Utility tests (can run anywhere)
./vendor/bin/phpunit tests/InternalNetwork/Utils/
```

### Run Individual Test Classes
```bash
# OSS internal endpoint functionality
./vendor/bin/phpunit tests/InternalNetwork/OSS/OSSInternalEndpointTest.php

# TOS internal endpoint functionality  
./vendor/bin/phpunit tests/InternalNetwork/TOS/TOSInternalEndpointTest.php

# FileService internal endpoint functionality
./vendor/bin/phpunit tests/InternalNetwork/FileService/FileServiceInternalEndpointTest.php

# Endpoint conversion utilities
./vendor/bin/phpunit tests/InternalNetwork/Utils/EasyFileToolsTest.php
```

## Test Categories

### Utils Tests
- **EasyFileToolsTest**: Tests endpoint conversion logic
- **Can run anywhere**: These tests don't require cloud network access

### Platform Tests  
- **OSSInternalEndpointTest**: Tests OSS internal network functionality
- **TOSInternalEndpointTest**: Tests TOS internal network functionality
- **FileServiceInternalEndpointTest**: Tests FileService internal network functionality
- **Require cloud network**: These tests will fail if not run in appropriate cloud environments

## Expected Behavior

### Inside Cloud Environment
- All tests should pass
- Internal endpoints should be accessible
- Upload/download operations should succeed

### Outside Cloud Environment (Local Development)
- Utils tests should pass (endpoint conversion logic works)
- Platform tests will fail with network connectivity errors (expected behavior)
- This confirms that internal endpoint conversion is working correctly

## Troubleshooting

### Connection Timeouts
If you see connection timeout errors when running platform tests locally, this is **expected behavior**. It confirms that:
1. Internal endpoint conversion is working
2. Your local machine cannot access cloud internal networks
3. The feature will work correctly when deployed in the cloud

### DNS Resolution Errors
Similar to timeouts, DNS resolution errors for internal domains (`.ivolces.com`, `-internal.aliyuncs.com`) indicate proper functionality when run outside cloud environments.

### Token Errors
For FileService tests, ensure you have valid tokens configured in your `storages.json` file.

## Configuration

The tests use the same configuration as regular tests but are isolated to prevent interference with the main test suite. Internal network tests are configured to:

1. Use real cloud storage configurations
2. Test actual network connectivity to internal endpoints  
3. Validate option propagation through the entire call chain
4. Verify endpoint conversion at multiple levels

## Important Notes

- **Do not** modify these tests to "pass" in local environments
- Test failures in local environments **confirm** the feature is working correctly
- Only run these tests in cloud environments for validation
- Internal network access requires proper cloud infrastructure setup 