<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Authentication\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 登录请求DTO.
 */
class CheckLoginRequest extends AbstractDTO
{
    /**
     * 邮箱.
     */
    protected string $email = '';

    /**
     * 密码
     */
    protected string $password;

    /**
     * 组织编码,不传默认为空.
     */
    protected string $organizationCode = '';

    /**
     * 国家代码
     */
    protected string $stateCode = '+86';

    /**
     * 手机号.
     */
    protected string $phone = '';

    /**
     * 重定向URL.
     */
    protected string $redirect = '';

    /**
     * 登录类型.
     */
    protected string $type = 'email_password';

    public function getEmail(): string
    {
        return $this->email;
    }

    public function setEmail(string $email): void
    {
        $this->email = $email;
    }

    public function getPassword(): string
    {
        return $this->password;
    }

    public function setPassword(string $password): void
    {
        $this->password = $password;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getStateCode(): string
    {
        return $this->stateCode;
    }

    public function setStateCode(string $stateCode): void
    {
        $this->stateCode = $stateCode;
    }

    public function getPhone(): string
    {
        return $this->phone;
    }

    public function setPhone(string $phone): void
    {
        $this->phone = $phone;
    }

    public function getRedirect(): string
    {
        return $this->redirect;
    }

    public function setRedirect(string $redirect): void
    {
        $this->redirect = $redirect;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): void
    {
        $this->type = $type;
    }
}
