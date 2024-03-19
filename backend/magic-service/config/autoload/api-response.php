<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
use App\ErrorCode\GenericErrorCode;
use App\ErrorCode\HttpErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use Dtyq\ApiResponse\Response\LowCodeResponse;
use Dtyq\ApiResponse\Response\StandardResponse;
use Hyperf\Validation\ValidationException;
use Qbhy\HyperfAuth\Exception\UnauthorizedException;

return [
    'default' => [
        'version' => 'standard',
    ],
    // AOP处理器会自动捕获此处配置的异常,并返回错误结构体(实现类必须继承Exception).
    'error_exception' => [
        BusinessException::class,
        UnauthorizedException::class => static function (UnauthorizedException $exception) {
            return [
                'code' => HttpErrorCode::Unauthorized->value,
                'message' => $exception->getMessage(),
            ];
        },
        ValidationException::class => static function (ValidationException $exception) {
            return [
                'code' => GenericErrorCode::ParameterValidationFailed->value,
                'message' => $exception->validator->errors()->first(),
            ];
        },
    ],

    'version' => [
        'standard' => StandardResponse::class,
        'low_code' => LowCodeResponse::class,
    ],
];
