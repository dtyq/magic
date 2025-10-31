<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'success' => [
        'success' => 'Success',
    ],
    'driver_error' => [
        'driver_not_found' => 'ASR driver not found for configuration: :config',
    ],
    'request_error' => [
        'invalid_params' => 'Invalid request parameters',
        'no_permission' => 'No access permission',
        'freq_limit' => 'Access frequency exceeded',
        'quota_limit' => 'Access quota exceeded',
    ],
    'server_error' => [
        'server_busy' => 'Server busy',
        'unknown_error' => 'Unknown error',
    ],
    'audio_error' => [
        'audio_too_long' => 'Audio too long',
        'audio_too_large' => 'Audio too large',
        'invalid_audio' => 'Invalid audio format',
        'audio_silent' => 'Audio is silent',
        'analysis_failed' => 'Audio file analysis failed',
        'invalid_parameters' => 'Invalid audio parameters',
    ],
    'recognition_error' => [
        'wait_timeout' => 'Recognition waiting timeout',
        'process_timeout' => 'Recognition processing timeout',
        'recognize_error' => 'Recognition error',
    ],
    'connection_error' => [
        'websocket_connection_failed' => 'WebSocket connection failed',
    ],
    'file_error' => [
        'file_not_found' => 'Audio file not found',
        'file_open_failed' => 'Failed to open audio file',
        'file_read_failed' => 'Failed to read audio file',
    ],
    'invalid_audio_url' => 'Invalid audio URL format',
    'audio_url_required' => 'Audio URL is required',
    'processing_error' => [
        'decompression_failed' => 'Failed to decompress payload',
        'json_decode_failed' => 'Failed to decode JSON',
    ],
    'config_error' => [
        'invalid_config' => 'Invalid configuration',
        'invalid_language' => 'Unsupported language',
        'unsupported_platform' => 'Unsupported ASR platform : :platform',
        'invalid_magic_id' => 'Invalid magic id',
    ],
    'uri_error' => [
        'uri_open_failed' => 'Failed to open audio URI',
        'uri_read_failed' => 'Failed to read audio URI',
    ],
    'download' => [
        'success' => 'Successfully obtained download link',
        'file_not_exist' => 'Merged audio file does not exist, please process voice summary first',
        'get_link_failed' => 'Unable to obtain merged audio file access link',
        'get_link_error' => 'Failed to get download link: :error',
    ],
    'api' => [
        'validation' => [
            'task_key_required' => 'Task key parameter is required',
            'project_id_required' => 'Project ID parameter is required',
            'chat_topic_id_required' => 'Chat topic ID parameter is required',
            'model_id_required' => 'Model ID parameter is required',
            'retry_files_uploaded' => 'Files have been re-uploaded to project workspace',
            'file_required' => 'File parameter is required',
            'task_not_found' => 'Task not found or expired',
            'task_not_exist' => 'Task does not exist or has expired',
            'upload_audio_first' => 'Please upload audio files first',
            'project_not_found' => 'Project not found',
            'project_access_denied_organization' => 'Project does not belong to current organization, access denied',
            'project_access_denied_user' => 'No permission to access this project',
            'project_access_validation_failed' => 'Project permission validation failed: :error',
            'note_content_too_long' => 'Note content is too long, maximum 10000 characters supported, current :length characters',
        ],
        'upload' => [
            'start_log' => 'ASR file upload started',
            'success_log' => 'ASR file upload successful',
            'success_message' => 'File upload successful',
            'failed_log' => 'ASR file upload failed',
            'failed_exception' => 'File upload failed: :error',
        ],
        'token' => [
            'cache_cleared' => 'ASR Token cache cleared successfully',
            'cache_not_exist' => 'ASR Token cache does not exist',
            'access_token_not_configured' => 'ASR access token not configured',
            'sts_get_failed' => 'STS Token acquisition failed: temporary_credential.dir is empty, please check storage service configuration',
            'usage_note' => 'This Token is dedicated for ASR recording file chunked upload, please upload recording files to the specified directory',
            'reuse_task_log' => 'Reusing task key, refreshing STS Token',
        ],
        'speech_recognition' => [
            'task_id_missing' => 'Speech recognition task ID does not exist',
            'request_id_missing' => 'Speech recognition service did not return request ID',
            'submit_failed' => 'Audio conversion task submission failed: :error',
            'silent_audio_error' => 'Silent audio, please check if the audio file contains valid speech content',
            'internal_server_error' => 'Internal server processing error, status code: :code',
            'unknown_status_error' => 'Speech recognition failed, unknown status code: :code',
        ],
        'directory' => [
            'invalid_asr_path' => 'Directory must contain "/asr/recordings" path',
            'security_path_error' => 'Directory path cannot contain ".." for security reasons',
            'ownership_error' => 'Directory does not belong to current user',
            'invalid_structure' => 'Invalid ASR directory structure',
            'invalid_structure_after_recordings' => 'Invalid directory structure after "/asr/recordings"',
            'user_id_not_found' => 'User ID not found in directory path',
        ],
        'status' => [
            'get_file_list_failed' => 'ASR status query: Failed to get file list',
        ],
        'redis' => [
            'save_task_status_failed' => 'Redis task status save failed',
        ],
        'lock' => [
            'acquire_failed' => 'Failed to acquire lock, another summary task is in progress, please try again later',
        ],
    ],

    // Directory related
    'directory' => [
        'recordings_summary_folder' => 'Recording Summary',
    ],

    // File names related
    'file_names' => [
        'recording_prefix' => 'Recording',
        'merged_audio_prefix' => 'Recording File',
        'original_recording' => 'Original Recording',
        'transcription_prefix' => 'Transcription Result',
        'summary_prefix' => 'Recording Summary',
        'note_prefix' => 'Recording Note',
        'note_suffix' => 'Note', // For generating note filenames with title: {title}-Note.{ext}
    ],

    // Markdown content related
    'markdown' => [
        'transcription_title' => 'Speech-to-Text Result',
        'transcription_content_title' => 'Transcription Content',
        'summary_title' => 'AI Recording Summary',
        'summary_content_title' => 'AI Summary Content',
        'task_id_label' => 'Task ID',
        'generate_time_label' => 'Generated Time',
    ],

    // Chat messages related
    'messages' => [
        'summary_content' => ' Summarize content',
        'summary_content_with_note' => 'When summarizing the recording, please refer to the recording note file in the same directory and base the summary on both the note and the recording.',
        // New prefix/suffix i18n (without note)
        'summary_prefix' => 'Please help summarize the recording in ',
        'summary_suffix' => ' into a minutes document, and combine the note content to create a detailed HTML analysis report.',
        // New prefix/suffix i18n (with note)
        'summary_prefix_with_note' => 'Please help me organize the recording content in ',
        'summary_middle_with_note' => ' and my note content in ',
        'summary_suffix_with_note' => ' into a minutes document.',
    ],
];
