<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'success' => [
        'success' => '成功',
    ],
    'request_error' => [
        'invalid_params' => '请求参数无效',
        'no_permission' => '无访问权限',
        'freq_limit' => '访问频率超限',
        'quota_limit' => '访问配额超限',
    ],
    'driver_error' => [
        'driver_not_found' => '未找到 ASR 驱动程序，配置类型: :config',
    ],
    'server_error' => [
        'server_busy' => '服务器繁忙',
        'unknown_error' => '未知错误',
    ],
    'audio_error' => [
        'audio_too_long' => '音频时长过长',
        'audio_too_large' => '音频文件过大',
        'invalid_audio' => '音频格式无效',
        'audio_silent' => '音频静音',
        'analysis_failed' => '音频文件分析失败',
        'invalid_parameters' => '无效的音频参数',
    ],
    'recognition_error' => [
        'wait_timeout' => '识别等待超时',
        'process_timeout' => '识别处理超时',
        'recognize_error' => '识别错误',
    ],
    'connection_error' => [
        'websocket_connection_failed' => 'WebSocket连接失败',
    ],
    'file_error' => [
        'file_not_found' => '音频文件不存在',
        'file_open_failed' => '无法打开音频文件',
        'file_read_failed' => '读取音频文件失败',
    ],
    'invalid_audio_url' => '音频URL格式无效',
    'audio_url_required' => '音频URL不能为空',
    'processing_error' => [
        'decompression_failed' => '解压失败',
        'json_decode_failed' => 'JSON解码失败',
    ],
    'config_error' => [
        'invalid_config' => '无效的配置',
        'invalid_language' => '不支持的语言',
        'unsupported_platform' => '不支持的 ASR 平台 : :platform',
    ],
    'uri_error' => [
        'uri_open_failed' => '无法打开音频 URI',
        'uri_read_failed' => '无法读取音频 URI',
    ],
];
