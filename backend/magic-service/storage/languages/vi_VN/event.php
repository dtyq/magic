<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'delivery_failed' => 'Giao sự kiện thất bại',
    'publisher_not_found' => 'Không tìm thấy nhà phát hành sự kiện',
    'exchange_not_found' => 'Không tìm thấy exchange sự kiện',
    'routing_key_invalid' => 'Routing key của sự kiện không hợp lệ',

    'consumer_execution_failed' => 'Thực thi consumer sự kiện thất bại',
    'consumer_not_found' => 'Không tìm thấy consumer sự kiện',
    'consumer_timeout' => 'Consumer sự kiện quá thời gian',
    'consumer_retry_exceeded' => 'Consumer thử lại vượt quá giới hạn',
    'consumer_validation_failed' => 'Xác thực consumer sự kiện thất bại',

    'data_serialization_failed' => 'Tuần tự hóa dữ liệu sự kiện thất bại',
    'data_deserialization_failed' => 'Giải tuần tự dữ liệu sự kiện thất bại',
    'data_validation_failed' => 'Xác thực dữ liệu sự kiện thất bại',
    'data_format_invalid' => 'Định dạng dữ liệu sự kiện không hợp lệ',

    'queue_connection_failed' => 'Kết nối hàng đợi sự kiện thất bại',
    'queue_not_found' => 'Không tìm thấy hàng đợi sự kiện',
    'queue_full' => 'Hàng đợi sự kiện đầy',
    'queue_permission_denied' => 'Từ chối quyền hàng đợi sự kiện',

    'processing_interrupted' => 'Xử lý sự kiện bị gián đoạn',
    'processing_deadlock' => 'Xử lý sự kiện bị bế tắc',
    'processing_resource_exhausted' => 'Tài nguyên xử lý sự kiện cạn kiệt',
    'processing_dependency_failed' => 'Phụ thuộc xử lý sự kiện thất bại',

    'configuration_invalid' => 'Cấu hình sự kiện không hợp lệ',
    'handler_not_registered' => 'Trình xử lý sự kiện chưa được đăng ký',
    'listener_registration_failed' => 'Đăng ký listener sự kiện thất bại',

    'system_unavailable' => 'Hệ thống sự kiện không khả dụng',
    'system_overloaded' => 'Hệ thống sự kiện quá tải',
    'system_maintenance' => 'Hệ thống sự kiện đang bảo trì',

    'points' => [
        'insufficient' => 'Điểm không đủ',
    ],
    'task' => [
        'pending' => 'Nhiệm vụ đang chờ xử lý',
        'stop' => 'Nhiệm vụ đã dừng',
    ],
    'credit' => [
        'insufficient_limit' => 'Hạn mức tín dụng không đủ',
    ],
];
