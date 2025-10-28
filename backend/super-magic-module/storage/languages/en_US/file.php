<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'file_not_found' => 'File not found',
    'file_exist' => 'File already exists',
    'illegal_file_key' => 'Illegal file key',
    'target_parent_not_directory' => 'Target parent is not a directory',
    'cannot_move_to_subdirectory' => 'Cannot move directory to its subdirectory',
    'file_move_failed' => 'Failed to move file',
    'file_save_failed' => 'Failed to save file',
    'file_create_failed' => 'Failed to create file',
    'file_delete_failed' => 'Failed to delete file',
    'file_rename_failed' => 'Failed to rename file',
    'directory_delete_failed' => 'Failed to delete directory',
    'batch_delete_failed' => 'Failed to batch delete files',
    'batch_move_failed' => 'Failed to batch move files',
    'permission_denied' => 'File permission denied',
    'files_not_found_or_no_permission' => 'Files not found or no permission to access',
    'content_too_large' => 'File content too large',
    'concurrent_modification' => 'File concurrent modification conflict',
    'save_rate_limit' => 'File save rate limit exceeded',
    'upload_failed' => 'File upload failed',

    // Batch download related
    'batch_file_ids_required' => 'File IDs are required',
    'batch_file_ids_invalid' => 'Invalid file ID format',
    'batch_too_many_files' => 'Cannot batch download more than 1000 files',
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
    'convert_failed' => 'File conversion failed, please try again',
    'convert_md_to_ppt_not_supported' => 'Converting Markdown to PPT is not supported',

    // File version related
    'cannot_version_directory' => 'Cannot create version for directory',
    'version_create_failed' => 'Failed to create file version',
    'access_denied' => 'Access denied',

    // File replace related
    'file_replace_failed' => 'Failed to replace file',
    'cannot_replace_directory' => 'Cannot replace directory, only files can be replaced',
    'source_file_not_found_in_storage' => 'Source file not found in cloud storage',
    'target_file_already_exists' => 'Target file name already exists in this directory',
    'file_is_being_edited' => 'File is currently being edited by other users, use force_replace to override',
    'source_file_key_illegal' => 'Source file key is illegal or outside of workspace',
];
