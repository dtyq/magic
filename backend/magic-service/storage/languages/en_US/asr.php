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
];
