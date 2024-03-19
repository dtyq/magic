<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Authentication\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 登录响应DTO.
 */
class CheckLoginResponse extends AbstractDTO
{
    /**
     * 状态码
     */
    protected int $code = 1000;

    /**
     * 消息.
     */
    protected string $message = '请求成功';

    /**
     * 返回数据.
     */
    protected array $data;

    /**
     * 设置返回数据.
     */
    public function setData(array $data): void
    {
        $this->data = $data;
    }

    /**
     * 获取返回数据.
     */
    public function getData(): array
    {
        return $this->data;
    }

    /**
     * 设置状态码
     */
    public function setCode(int $code): void
    {
        $this->code = $code;
    }

    /**
     * 获取状态码
     */
    public function getCode(): int
    {
        return $this->code;
    }

    /**
     * 设置消息.
     */
    public function setMessage(string $message): void
    {
        $this->message = $message;
    }

    /**
     * 获取消息.
     */
    public function getMessage(): string
    {
        return $this->message;
    }
}
