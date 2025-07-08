<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'fields' => [
        'code' => 'Mã',
        'name' => 'Tên',
        'description' => 'Mô tả',
        'status' => 'Trạng thái',
        'external_sse_url' => 'URL Dịch vụ MCP',
        'url' => 'URL',
        'command' => 'Lệnh',
        'arguments' => 'Tham số',
        'headers' => 'Tiêu đề',
        'env' => 'Biến Môi trường',
        'oauth2_config' => 'Cấu hình OAuth2',
        'client_id' => 'ID Khách hàng',
        'client_secret' => 'Mật khẩu Khách hàng',
        'client_url' => 'URL Khách hàng',
        'scope' => 'Phạm vi',
        'authorization_url' => 'URL Ủy quyền',
        'authorization_content_type' => 'Loại Nội dung Ủy quyền',
        'issuer_url' => 'URL Nhà phát hành',
        'redirect_uri' => 'URI Chuyển hướng',
        'use_pkce' => 'Sử dụng PKCE',
        'response_type' => 'Loại Phản hồi',
        'grant_type' => 'Loại Cấp phép',
        'additional_params' => 'Tham số Bổ sung',
        'created_at' => 'Tạo lúc',
        'updated_at' => 'Cập nhật lúc',
    ],
    'auth_type' => [
        'none' => 'Không xác thực',
        'oauth2' => 'Xác thực OAuth2',
    ],

    // Thông báo lỗi
    'validate_failed' => 'Xác thực thất bại',
    'not_found' => 'Không tìm thấy dữ liệu',

    // Lỗi liên quan đến dịch vụ
    'service' => [
        'already_exists' => 'Dịch vụ MCP đã tồn tại',
        'not_enabled' => 'Dịch vụ MCP chưa được kích hoạt',
    ],

    // Lỗi liên quan đến máy chủ
    'server' => [
        'not_support_check_status' => 'Không hỗ trợ kiểm tra trạng thái máy chủ loại này',
    ],

    // Lỗi quan hệ tài nguyên
    'rel' => [
        'not_found' => 'Không tìm thấy tài nguyên liên quan',
        'not_enabled' => 'Tài nguyên liên quan chưa được kích hoạt',
    ],
    'rel_version' => [
        'not_found' => 'Không tìm thấy phiên bản tài nguyên liên quan',
    ],

    // Lỗi công cụ
    'tool' => [
        'execute_failed' => 'Thực thi công cụ thất bại',
    ],

    // Lỗi xác thực OAuth2
    'oauth2' => [
        'authorization_url_generation_failed' => 'Không thể tạo URL ủy quyền OAuth2',
        'callback_handling_failed' => 'Không thể xử lý callback OAuth2',
        'token_refresh_failed' => 'Không thể làm mới token OAuth2',
        'invalid_response' => 'Phản hồi không hợp lệ từ nhà cung cấp OAuth2',
        'provider_error' => 'Nhà cung cấp OAuth2 trả về lỗi',
        'missing_access_token' => 'Không nhận được access token từ nhà cung cấp OAuth2',
        'invalid_service_configuration' => 'Cấu hình dịch vụ OAuth2 không hợp lệ',
        'missing_configuration' => 'Thiếu cấu hình OAuth2',
        'not_authenticated' => 'Không tìm thấy xác thực OAuth2 cho dịch vụ này',
        'no_refresh_token' => 'Không có refresh token để làm mới token',
        'binding' => [
            'code_empty' => 'Mã ủy quyền không được để trống',
            'state_empty' => 'Tham số trạng thái không được để trống',
            'mcp_server_code_empty' => 'Mã máy chủ MCP không được để trống',
        ],
    ],

    // Lỗi xác thực lệnh
    'command' => [
        'not_allowed' => 'Lệnh không được hỗ trợ ":command", hiện tại chỉ hỗ trợ: :allowed_commands',
    ],

    // Lỗi xác thực trường bắt buộc
    'required_fields' => [
        'missing' => 'Thiếu trường bắt buộc: :fields',
        'empty' => 'Trường bắt buộc không được để trống: :fields',
    ],

    // Lỗi liên quan đến STDIO executor
    'executor' => [
        'stdio' => [
            'connection_failed' => 'Kết nối STDIO executor thất bại',
            'access_denied' => 'Chức năng STDIO executor tạm thời không được hỗ trợ',
        ],
        'http' => [
            'connection_failed' => 'Kết nối HTTP executor thất bại',
        ],
    ],
];
