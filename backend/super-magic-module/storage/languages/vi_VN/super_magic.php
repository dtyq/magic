<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'agent' => [
        'fields' => [
            'code' => 'Mã',
            'codes' => 'Danh sách mã',
            'name' => 'Tên',
            'description' => 'Mô tả',
            'icon' => 'Biểu tượng',
            'type' => 'Loại',
            'enabled' => 'Trạng thái kích hoạt',
            'prompt' => 'Lời nhắc',
            'tools' => 'Cấu hình công cụ',
            'tool_code' => 'Mã công cụ',
            'tool_name' => 'Tên công cụ',
            'tool_type' => 'Loại công cụ',
            // Trường chung
            'page' => 'Trang',
            'page_size' => 'Kích thước trang',
            'creator_id' => 'ID người tạo',
        ],
        'limit_exceeded' => 'Đã đạt giới hạn Agent (:limit), không thể tạo thêm',
        'builtin_not_allowed' => 'Thao tác này không được hỗ trợ cho Agent có sẵn',
        // Migrated from crew.php
        'validate_failed' => 'Xác thực thất bại',
        'not_found' => 'Không tìm thấy Crew',
        'save_failed' => 'Lưu Crew thất bại',
        'delete_failed' => 'Xóa Crew thất bại',
        'operation_failed' => 'Thao tác thất bại',
        'access_denied' => 'Không có quyền truy cập Crew này',
    ],
    'task' => [
        'prompt_length_exceeded' => 'Văn bản nhập vào quá dài. Vui lòng tải lên dưới dạng tệp và tham chiếu trong hộp thoại.',
    ],
];
