<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\ErrorCode;

use App\Infrastructure\Core\Exception\Annotation\ErrorMessage;

enum UserErrorCode: int
{
    case NOT_BIND_THIRD_PLATFORM = 2150;

    #[ErrorMessage('user.phone_has_register')]
    case PHONE_HAS_REGISTER = 2151;

    case PHONE_OR_PASSWORD_ERROR = 2152;

    #[ErrorMessage('user.phone_not_bind_user')]
    case PHONE_NOT_BIND_USER = 2153;

    #[ErrorMessage('user.account_error')]
    case ACCOUNT_ERROR = 2154;

    #[ErrorMessage('user.user_not_exist')]
    case USER_NOT_EXIST = 2155;

    #[ErrorMessage('user.ai_code_exist')]
    case AI_CODE_EXIST = 2156;

    case SAAS_ERROR = 2160;
    case LOGIN_RATE_LIMIT = 2161;

    #[ErrorMessage('response.sms_rate_limit')]
    case SMS_RATE_LIMIT = 2162;

    case CDK_EXPIRED_OR_INVALID = 2163;
    case IDENTIFY_VERIFY_ERROR = 2166;

    #[ErrorMessage('user.verify_code_has_expired')]
    case VERIFY_CODE_HAS_EXPIRED = 2167;

    #[ErrorMessage('user.verify_code_error')]
    case VERIFY_CODE_ERROR = 2168;

    case STAFF_MOBILE_HAS_EXIST = 2169;
    case ACCOUNT_HAS_BIND_PARTNER = 2170;
    case ACCOUNT_HAS_BIND_STAFF = 2171;
    case ACCOUNT_REPEAT_BIND_PARTNER = 2172;
    case ACCOUNT_REPEAT_BIND_STAFF = 2173;

    // 用户创建太频繁
    #[ErrorMessage('user.create_user_too_frequently')]
    case CREATE_USER_TOO_FREQUENTLY = 2174;

    // 创建id关联关系太频繁
    #[ErrorMessage('user.create_id_relation_too_frequently')]
    case CREATE_ID_RELATION_TOO_FREQUENTLY = 2175;

    // 手机号异常
    #[ErrorMessage('user.phone_error')]
    case PHONE_ERROR = 2177;

    #[ErrorMessage('user.phone_login_is_exist')]
    case PHONE_INVALID = 2178;

    // auth_token 不存在
    #[ErrorMessage('user.token_not_found')]
    case TOKEN_NOT_FOUND = 2179;

    // 输入参数错误
    #[ErrorMessage('user.input_param_error')]
    case INPUT_PARAM_ERROR = 2180;

    // 收件人类型异常
    #[ErrorMessage('user.receive_type_error')]
    case RECEIVE_TYPE_ERROR = 2181;

    // 用户所在组织不存在
    #[ErrorMessage('user.organization_not_exist')]
    case ORGANIZATION_NOT_EXIST = 2182;

    // 用户会话异常
    #[ErrorMessage('user.conversation_error')]
    case CONVERSATION_ERROR = 2183;

    // 用户类型异常
    #[ErrorMessage('user.user_type_error')]
    case USER_TYPE_ERROR = 2184;

    // 组织没有授权
    #[ErrorMessage('user.organization_not_authorize')]
    case ORGANIZATION_NOT_AUTHORIZE = 2185;
}
