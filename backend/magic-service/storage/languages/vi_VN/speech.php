<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'volcengine' => [
        'invalid_response_format' => 'Định dạng phản hồi từ Volcengine không hợp lệ',
        'submit_failed' => 'Không thể gửi tác vụ đến API Volcengine',
        'submit_exception' => 'Xảy ra ngoại lệ khi gửi tác vụ đến Volcengine',
        'query_failed' => 'Không thể truy vấn kết quả từ API Volcengine',
        'query_exception' => 'Xảy ra ngoại lệ khi truy vấn kết quả từ Volcengine',
        'config_incomplete' => 'Cấu hình Volcengine không đầy đủ. Thiếu app_id, token hoặc cluster',
        'task_id_required' => 'ID tác vụ không thể để trống',
        'bigmodel' => [
            'invalid_response_format' => 'Định dạng phản hồi từ BigModel ASR không hợp lệ',
            'submit_exception' => 'Xảy ra ngoại lệ khi gửi tác vụ đến BigModel ASR',
            'query_exception' => 'Xảy ra ngoại lệ khi truy vấn kết quả từ BigModel ASR',
        ],
    ],
];
