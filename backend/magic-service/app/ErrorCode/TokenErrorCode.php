<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * 范围:9000, 10000.
 */
enum TokenErrorCode: int
{
    // token不存在
    #[ErrorMessage(message: 'token.not_found')]
    case TokenNotFound = 9000;

    // token过期
    #[ErrorMessage(message: 'token.expired')]
    case TokenExpired = 9001;

    // token类型不正确
    #[ErrorMessage(message: 'token.type_error')]
    case TokenTypeError = 9002;

    // 没有检测到Token关联的数据
    #[ErrorMessage(message: 'token.relation_not_found')]
    case TokenRelationNotFound = 9003;

    // token必须设置一个有效期
    #[ErrorMessage(message: 'token.expired_at_must_set')]
    case TokenExpiredAtMustSet = 9004;

    // token必选关联一个值
    #[ErrorMessage(message: 'token.relation_value_must_set')]
    case TokenRelationValueMustSet = 9005;

    // token不唯一
    #[ErrorMessage(message: 'token.not_unique')]
    case TokenNotUnique = 9006;

    // token类型异常
    #[ErrorMessage(message: 'token.type_exception')]
    case TokenTypeException = 9007;
}
