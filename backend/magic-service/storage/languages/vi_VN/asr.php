<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'success' => [
        'success' => 'Thành công',
    ],
    'driver_error' => [
        'driver_not_found' => 'Không tìm thấy trình điều khiển ASR cho cấu hình: :config',
    ],
    'request_error' => [
        'invalid_params' => 'Tham số yêu cầu không hợp lệ',
        'no_permission' => 'Không có quyền truy cập',
        'freq_limit' => 'Vượt quá tần suất truy cập',
        'quota_limit' => 'Vượt quá hạn ngạch truy cập',
    ],
    'server_error' => [
        'server_busy' => 'Máy chủ bận',
        'unknown_error' => 'Lỗi không xác định',
    ],
    'audio_error' => [
        'audio_too_long' => 'Âm thanh quá dài',
        'audio_too_large' => 'Âm thanh quá lớn',
        'invalid_audio' => 'Định dạng âm thanh không hợp lệ',
        'audio_silent' => 'Âm thanh im lặng',
        'analysis_failed' => 'Phân tích tệp âm thanh thất bại',
        'invalid_parameters' => 'Tham số âm thanh không hợp lệ',
    ],
    'recognition_error' => [
        'wait_timeout' => 'Hết thời gian chờ nhận dạng',
        'process_timeout' => 'Hết thời gian xử lý nhận dạng',
        'recognize_error' => 'Lỗi nhận dạng',
    ],
    'connection_error' => [
        'websocket_connection_failed' => 'Kết nối WebSocket thất bại',
    ],
    'file_error' => [
        'file_not_found' => 'Không tìm thấy tệp âm thanh',
        'file_open_failed' => 'Không thể mở tệp âm thanh',
        'file_read_failed' => 'Không thể đọc tệp âm thanh',
    ],
    'invalid_audio_url' => 'Định dạng URL âm thanh không hợp lệ',
    'audio_url_required' => 'URL âm thanh là bắt buộc',
    'processing_error' => [
        'decompression_failed' => 'Không thể giải nén payload',
        'json_decode_failed' => 'Không thể giải mã JSON',
    ],
    'config_error' => [
        'invalid_config' => 'Cấu hình không hợp lệ',
        'invalid_language' => 'Ngôn ngữ không được hỗ trợ',
        'unsupported_platform' => 'Nền tảng ASR không được hỗ trợ : :platform',
    ],
    'uri_error' => [
        'uri_open_failed' => 'Không thể mở URI âm thanh',
        'uri_read_failed' => 'Không thể đọc URI âm thanh',
    ],
    'download' => [
        'success' => 'Lấy liên kết tải xuống thành công',
        'file_not_exist' => 'Tệp âm thanh đã hợp nhất không tồn tại, vui lòng xử lý tóm tắt giọng nói trước',
        'get_link_failed' => 'Không thể lấy liên kết truy cập tệp âm thanh đã hợp nhất',
        'get_link_error' => 'Không thể lấy liên kết tải xuống: :error',
    ],
    'api' => [
        'validation' => [
            'task_key_required' => 'Tham số khóa nhiệm vụ là bắt buộc',
            'project_id_required' => 'Tham số ID dự án là bắt buộc',
            'chat_topic_id_required' => 'Tham số ID chủ đề trò chuyện là bắt buộc',
            'model_id_required' => 'Tham số ID mô hình là bắt buộc',
            'file_required' => 'Tham số tệp là bắt buộc',
            'task_not_found' => 'Không tìm thấy nhiệm vụ hoặc đã hết hạn',
            'task_not_exist' => 'Nhiệm vụ không tồn tại hoặc đã hết hạn',
            'upload_audio_first' => 'Vui lòng tải lên tệp âm thanh trước',
        ],
        'upload' => [
            'start_log' => 'Bắt đầu tải lên tệp ASR',
            'success_log' => 'Tải lên tệp ASR thành công',
            'success_message' => 'Tải lên tệp thành công',
            'failed_log' => 'Tải lên tệp ASR thất bại',
            'failed_exception' => 'Tải lên tệp thất bại: :error',
        ],
        'token' => [
            'cache_cleared' => 'Xóa cache ASR Token thành công',
            'cache_not_exist' => 'Cache ASR Token không tồn tại',
            'access_token_not_configured' => 'ASR access token chưa được cấu hình',
            'sts_get_failed' => 'Lấy STS Token thất bại: temporary_credential.dir trống, vui lòng kiểm tra cấu hình dịch vụ lưu trữ',
            'usage_note' => 'Token này dành riêng cho việc tải lên tệp ghi âm ASR theo từng phần, vui lòng tải lên tệp ghi âm vào thư mục được chỉ định',
            'reuse_task_log' => 'Tái sử dụng khóa nhiệm vụ, làm mới STS Token',
        ],
        'speech_recognition' => [
            'task_id_missing' => 'ID nhiệm vụ nhận dạng giọng nói không tồn tại',
            'request_id_missing' => 'Dịch vụ nhận dạng giọng nói không trả về request ID',
            'submit_failed' => 'Gửi nhiệm vụ chuyển đổi âm thanh thất bại: :error',
            'silent_audio_error' => 'Âm thanh im lặng, vui lòng kiểm tra xem tệp âm thanh có chứa nội dung giọng nói hợp lệ không',
            'internal_server_error' => 'Lỗi xử lý nội bộ máy chủ, mã trạng thái: :code',
            'unknown_status_error' => 'Nhận dạng giọng nói thất bại, mã trạng thái không xác định: :code',
        ],
        'directory' => [
            'invalid_asr_path' => 'Thư mục phải chứa đường dẫn "/asr/recordings"',
            'security_path_error' => 'Đường dẫn thư mục không được chứa ".." vì lý do bảo mật',
            'ownership_error' => 'Thư mục không thuộc về người dùng hiện tại',
            'invalid_structure' => 'Cấu trúc thư mục ASR không hợp lệ',
            'invalid_structure_after_recordings' => 'Cấu trúc thư mục không hợp lệ sau "/asr/recordings"',
            'user_id_not_found' => 'Không tìm thấy User ID trong đường dẫn thư mục',
        ],
        'status' => [
            'get_file_list_failed' => 'Truy vấn trạng thái ASR: Không thể lấy danh sách tệp',
        ],
        'redis' => [
            'save_task_status_failed' => 'Lưu trạng thái nhiệm vụ Redis thất bại',
        ],
    ],

    // Liên quan đến thư mục
    'directory' => [
        'recordings_summary_folder' => 'Tóm tắt ghi âm',
    ],

    // Liên quan đến tên tệp
    'file_names' => [
        'recording_prefix' => 'Ghi âm',
        'merged_audio_prefix' => 'Tệp ghi âm',
        'original_recording' => 'Tệp ghi âm gốc',
        'transcription_prefix' => 'Kết quả phiên âm',
        'summary_prefix' => 'Tóm tắt ghi âm',
    ],

    // Liên quan đến nội dung Markdown
    'markdown' => [
        'transcription_title' => 'Kết quả chuyển đổi giọng nói thành văn bản',
        'transcription_content_title' => 'Nội dung phiên âm',
        'summary_title' => 'Tóm tắt ghi âm AI',
        'summary_content_title' => 'Nội dung tóm tắt AI',
        'task_id_label' => 'ID Nhiệm vụ',
        'generate_time_label' => 'Thời gian tạo',
    ],

    // Liên quan đến tin nhắn chat
    'messages' => [
        'summary_content' => ' Tóm tắt nội dung',
    ],
];
