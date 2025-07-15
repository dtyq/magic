<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'permission_denied' => 'File permission denied',
    'content_too_large' => 'File content too large',
    'concurrent_modification' => 'File concurrent modification conflict',
    'save_rate_limit' => 'File save rate limit exceeded',
    'upload_failed' => 'File upload failed',

    // Batch download related
    'batch_file_ids_required' => 'File IDs are required',
    'batch_file_ids_invalid' => 'Invalid file ID format',
    'batch_too_many_files' => 'Cannot batch download more than 50 files',
    'batch_no_valid_files' => 'No valid accessible files found',
    'batch_access_denied' => 'Batch download task access denied',
    'batch_publish_failed' => 'Failed to publish batch download task',

    // File conversion related
    'convert_file_ids_required' => 'File IDs are required',
    'convert_too_many_files' => 'Cannot convert more than 50 files',
    'convert_no_valid_files' => 'No valid files for conversion',
    'convert_access_denied' => 'File conversion task access denied',
    'convert_same_sandbox_required' => 'Files must be in the same sandbox',
    'convert_create_zip_failed' => 'Failed to create ZIP file',
    'convert_no_converted_files' => 'No valid converted files to create ZIP',
];
