<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

/**
 * magic api 错误码范围:4000, 4999.
 */
enum MagicApiErrorCode: int
{
    // token不存在
    #[ErrorMessage(message: 'api.token.not_exist')]
    case TOKEN_NOT_EXIST = 4000;

    #[ErrorMessage(message: 'api.model.not_support')]
    case MODEL_NOT_SUPPORT = 4001;

    #[ErrorMessage(message: 'api.token.model_not_support')]
    case TOKEN_MODEL_NOT_SUPPORT = 4002;

    #[ErrorMessage(message: 'api.token.organization_not_support')]
    case TOKEN_ORGANIZATION_NOT_SUPPORT = 4003;

    // ip不在白名单
    #[ErrorMessage(message: 'api.token.ip_not_in_white_list')]
    case TOKEN_IP_NOT_IN_WHITE_LIST = 4004;

    // token过期
    #[ErrorMessage(message: 'api.token.expired')]
    case TOKEN_EXPIRED = 4005;

    // 组织的额度不足
    #[ErrorMessage(message: 'api.organization.quota_not_enough')]
    case ORGANIZATION_QUOTA_NOT_ENOUGH = 4006;

    // accessToken 额度不足
    #[ErrorMessage(message: 'api.token.quota_not_enough')]
    case TOKEN_QUOTA_NOT_ENOUGH = 4007;

    // 消息为空
    #[ErrorMessage(message: 'api.message.empty')]
    case MESSAGE_EMPTY = 4008;

    // 限流
    #[ErrorMessage(message: 'api.rate_limit')]
    case RATE_LIMIT = 4009;

    // 消息为空
    #[ErrorMessage(message: 'api.msg_empty')]
    case MSG_EMPTY = 4010;

    // 用户不存在
    #[ErrorMessage(message: 'api.user_id_not_exist')]
    case USER_ID_NOT_EXIST = 4011;

    // token 计算异常
    #[ErrorMessage(message: 'api.token.calculate_error')]
    case TOKEN_CALCULATE_ERROR = 4012;

    // token 创建失败
    #[ErrorMessage(message: 'api.token.create_error')]
    case TOKEN_CREATE_ERROR = 4013;

    // 用户创建的token数量超过限制
    #[ErrorMessage(message: 'api.user.create_access_token_limit')]
    case USER_CREATE_ACCESS_TOKEN_LIMIT = 4014;

    // 用户使用的token数量超过限制
    #[ErrorMessage(message: 'api.user.use_access_token_limit')]
    case USER_USE_ACCESS_TOKEN_LIMIT = 4015;

    // 用户创建accessToken频率限流
    #[ErrorMessage(message: 'api.user.create_access_token_rate_limit')]
    case USER_CREATE_ACCESS_TOKEN_RATE_LIMIT = 4016;

    // 大模型响应失败
    #[ErrorMessage(message: 'api.model.response_fail')]
    case MODEL_RESPONSE_FAIL = 4017;

    // 通用验证失败
    #[ErrorMessage(message: 'api.validate_failed')]
    case ValidateFailed = 4018;

    // token被禁用
    #[ErrorMessage(message: 'api.token.disabled')]
    case TOKEN_DISABLED = 4019;
}
