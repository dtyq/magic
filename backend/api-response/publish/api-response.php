<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use Dtyq\ApiResponse\Response\LowCodeResponse;
use Dtyq\ApiResponse\Response\StandardResponse;

return [
    'default' => [
        'version' => 'standard',
    ],
    // AOP处理器会自动捕获此处配置的异常,并返回错误结构体(实现类必须继承Exception).
    'error_exception' => [
        Exception::class,
    ],
    'version' => [
        'standard' => StandardResponse::class,
        'low_code' => LowCodeResponse::class,
    ],
];
