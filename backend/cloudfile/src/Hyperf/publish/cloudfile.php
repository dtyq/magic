<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    'storages' => [
        'file_service' => [
            'adapter' => 'file_service',
            'config' => [
                'host' => '',
                'platform' => '',
                'key' => '',
            ],
        ],
        'aliyun' => [
            'adapter' => 'aliyun',
            'config' => [
                'accessId' => '',
                'accessSecret' => '',
                'bucket' => '',
                'endpoint' => '',
                'role_arn' => '',
            ],
        ],
        'tos' => [
            'adapter' => 'tos',
            'config' => [
                'region' => '',
                'endpoint' => '',
                'ak' => '',
                'sk' => '',
                'bucket' => '',
                'trn' => '',
            ],
        ],
        'minio' => [
            'adapter' => 'minio',
            'config' => [
                // MinIO 服务地址，如：http://localhost:9000
                'endpoint' => env('MINIO_ENDPOINT', 'http://localhost:9000'),
                // 区域，默认 us-east-1
                'region' => env('MINIO_REGION', 'us-east-1'),
                // Access Key
                'accessKey' => env('MINIO_ACCESS_KEY', ''),
                // Secret Key
                'secretKey' => env('MINIO_SECRET_KEY', ''),
                // 存储桶名称
                'bucket' => env('MINIO_BUCKET', ''),
                // MinIO 必须使用 path-style 访问
                'use_path_style_endpoint' => true,
                // SDK 版本
                'version' => 'latest',
                // 可选：用于 STS 临时凭证的 Role ARN
                'role_arn' => env('MINIO_ROLE_ARN', ''),
                // 可选：STS 服务端点（如果与主服务不同）
                'sts_endpoint' => env('MINIO_STS_ENDPOINT', ''),
            ],
            // 可选：是否公开读
            'public_read' => false,
            // 可选：默认选项
            'options' => [],
        ],
    ],
];
