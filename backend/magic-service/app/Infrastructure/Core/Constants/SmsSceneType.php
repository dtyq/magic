<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Constants;

class SmsSceneType
{
    /**
     * 设备登出.
     */
    public const DEVICE_LOGOUT = 'device_logout';

    /**
     * 修改密码
     */
    public const CHANGE_PASSWORD = 'change_password';

    /**
     * 绑定手机.
     */
    public const BIND_PHONE = 'bind_phone';

    /**
     * 修改手机.
     */
    public const CHANGE_PHONE = 'change_phone';

    /**
     * 账号注册.
     */
    public const REGISTER_ACCOUNT = 'register_account';

    /**
     * 账号登录激活.
     */
    public const ACCOUNT_LOGIN_ACTIVE = 'account_login_active';

    /**
     * 账号注册激活.
     */
    public const ACCOUNT_REGISTER_ACTIVE = 'account_register_active';

    /**
     * 账号登录.
     */
    public const ACCOUNT_LOGIN = 'account_login';

    /**
     * 账号登录绑定第三方平台.
     */
    public const ACCOUNT_LOGIN_BIND_THIRD_PLATFORM = 'account_login_bind_third_platform';

    /**
     * 身份验证
     */
    public const IDENTIFY_VERIFY = 'identity_verify';
}
