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
        'invalid_magic_id' => '无效的 magic id',
        'invalid_language' => '不支持的语言',
        'unsupported_platform' => '不支持的 ASR 平台 : :platform',
    ],
    'uri_error' => [
        'uri_open_failed' => '无法打开音频 URI',
        'uri_read_failed' => '无法读取音频 URI',
    ],
    'download' => [
        'success' => '成功获取下载链接',
        'file_not_exist' => '合并音频文件不存在，请先进行语音总结处理',
        'get_link_failed' => '无法获取合并音频文件访问链接',
        'get_link_error' => '获取下载链接失败: :error',
    ],
    'api' => [
        'validation' => [
            'task_key_required' => 'Task key parameter is required',
            'project_id_required' => 'Project ID parameter is required',
            'chat_topic_id_required' => 'Chat topic ID parameter is required',
            'model_id_required' => '模型ID参数是必需的',
            'retry_files_uploaded' => 'Files have been re-uploaded to project workspace',
            'file_required' => 'File parameter is required',
            'task_not_found' => 'Task not found or expired',
            'task_not_exist' => '任务不存在或已过期',
            'upload_audio_first' => '请先上传音频文件',
            'project_not_found' => '项目不存在',
            'project_access_denied_organization' => '项目不属于当前组织，无访问权限',
            'project_access_denied_user' => '无权限访问该项目',
            'project_access_validation_failed' => '项目权限验证失败: :error',
            'note_content_too_long' => 'Note内容过长，最大支持10000字符，当前:length字符',
        ],
        'upload' => [
            'start_log' => 'ASR文件上传开始',
            'success_log' => 'ASR文件上传成功',
            'success_message' => '文件上传成功',
            'failed_log' => 'ASR文件上传失败',
            'failed_exception' => '文件上传失败: :error',
        ],
        'token' => [
            'cache_cleared' => 'ASR Token缓存清除成功',
            'cache_not_exist' => 'ASR Token缓存已不存在',
            'access_token_not_configured' => 'ASR access token 未配置',
            'sts_get_failed' => 'STS Token获取失败：temporary_credential.dir为空，请检查存储服务配置',
            'usage_note' => '此Token专用于ASR录音文件分片上传，请将录音文件上传到指定目录中',
            'reuse_task_log' => '复用任务键，刷新STS Token',
        ],
        'speech_recognition' => [
            'task_id_missing' => '语音识别任务ID不存在',
            'request_id_missing' => '语音识别服务未返回请求ID',
            'submit_failed' => '音频转换任务提交失败: :error',
            'silent_audio_error' => '静音音频，请检查音频文件是否包含有效语音内容',
            'internal_server_error' => '服务内部处理错误，状态码: :code',
            'unknown_status_error' => '语音识别失败，未知状态码: :code',
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
            'get_file_list_failed' => 'ASR状态查询：获取文件列表失败',
        ],
        'redis' => [
            'save_task_status_failed' => 'Redis任务状态保存失败',
        ],
        'lock' => [
            'acquire_failed' => '获取锁失败，另一个总结任务正在进行中，请稍后再试',
        ],
    ],

    // 目录相关
    'directory' => [
        'recordings_summary_folder' => '录音总结',
    ],

    // 文件名相关
    'file_names' => [
        'recording_prefix' => '录音',
        'merged_audio_prefix' => '录音文件',
        'original_recording' => '原始录音文件',
        'transcription_prefix' => '录音转文字结果',
        'summary_prefix' => '录音的总结',
        'note_prefix' => '录音的笔记',
        'note_suffix' => '笔记', // 用于生成带标题的笔记文件名：{title}-笔记.{ext}
    ],

    // Markdown内容相关
    'markdown' => [
        'transcription_title' => '录音转文字结果',
        'transcription_content_title' => '转录内容',
        'summary_title' => 'AI 录音总结',
        'summary_content_title' => 'AI 总结内容',
        'task_id_label' => '任务ID',
        'generate_time_label' => '生成时间',
    ],

    // 聊天消息相关
    'messages' => [
        'summary_content' => ' 总结内容',
        'summary_content_with_note' => '请在总结录音时参考同一目录下的录音笔记文件，并结合笔记与录音内容完成总结。',
        // 新的前后缀国际化（无笔记）
        'summary_prefix' => '请帮我把 ',
        'summary_suffix' => ' 中的录音内容整理成一份纪要文档。',
        // 新的前后缀国际化（有笔记）
        'summary_prefix_with_note' => '帮我把 ',
        'summary_middle_with_note' => ' 中的录音内容和 ',
        'summary_suffix_with_note' => ' 中的我的笔记内容整理成一份纪要文档,并结合笔记内容实现一份详细的html分析报告。',
    ],
];
