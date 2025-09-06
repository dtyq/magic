<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'general_error' => 'Hoạt động bộ nhớ dài hạn thất bại',
    'prompt_file_not_found' => 'Không tìm thấy tệp prompt: :path',
    'not_found' => 'Bộ nhớ không tồn tại',
    'creation_failed' => 'Tạo bộ nhớ thất bại',
    'update_failed' => 'Cập nhật bộ nhớ thất bại',
    'deletion_failed' => 'Xóa bộ nhớ thất bại',
    'evaluation' => [
        'llm_request_failed' => 'Yêu cầu đánh giá bộ nhớ thất bại',
        'llm_response_parse_failed' => 'Phân tích phản hồi đánh giá bộ nhớ thất bại',
        'score_parse_failed' => 'Phân tích điểm đánh giá bộ nhớ thất bại',
    ],
    'entity' => [
        'content_too_long' => 'Độ dài nội dung bộ nhớ không được vượt quá 65535 ký tự',
        'pending_content_too_long' => 'Độ dài nội dung bộ nhớ chờ thay đổi không được vượt quá 65535 ký tự',
        'enabled_status_restriction' => 'Chỉ có thể bật hoặc tắt bộ nhớ đã kích hoạt',
        'user_memory_limit_exceeded' => 'Đã đạt giới hạn bộ nhớ người dùng (20 bộ nhớ)',
    ],
    'api' => [
        'validation_failed' => 'Xác thực tham số thất bại: :errors',
        'memory_not_belong_to_user' => 'Bộ nhớ không tìm thấy hoặc không có quyền truy cập',
        'partial_memory_not_belong_to_user' => 'Một số bộ nhớ không tìm thấy hoặc không có quyền truy cập',
        'accept_memories_failed' => 'Chấp nhận đề xuất bộ nhớ thất bại: :error',
        'memory_created_successfully' => 'Tạo bộ nhớ thành công',
        'memory_updated_successfully' => 'Cập nhật bộ nhớ thành công',
        'memory_deleted_successfully' => 'Xóa bộ nhớ thành công',
        'memory_reinforced_successfully' => 'Tăng cường bộ nhớ thành công',
        'memories_batch_reinforced_successfully' => 'Tăng cường bộ nhớ hàng loạt thành công',
        'memories_accepted_successfully' => 'Chấp nhận thành công :count đề xuất bộ nhớ',
        'memories_rejected_successfully' => 'Từ chối thành công :count đề xuất bộ nhớ',
        'batch_process_memories_failed' => 'Xử lý hàng loạt đề xuất bộ nhớ thất bại',
        'batch_action_memories_failed' => 'Hàng loạt :action đề xuất bộ nhớ thất bại: :error',
        'user_manual_edit_explanation' => 'Người dùng chỉnh sửa nội dung bộ nhớ thủ công',
        'content_auto_compressed_explanation' => 'Nội dung quá dài, đã nén tự động',
        'parameter_validation_failed' => 'Xác thực tham số thất bại: :errors',
        'action_accept' => 'chấp nhận',
        'action_reject' => 'từ chối',
    ],
];
