<?php

declare(strict_types=1);
/**
 * This file is part of Dtyq.
 */
return [
    'access_key' => '您的阿里云AccessKey',
    'secret_key' => '您的阿里云SecretKey',
    'region' => 'cn-shenzhen', // 您的区域
    'endpoint' => 'fc.cn-shenzhen.aliyuncs.com', // 函数计算端点
    'function' => [
        'name' => 'test-code-runner',
        // 您可以在这里覆盖默认配置
        'code_package_path' => __DIR__ . '/../runner',
    ],
];
