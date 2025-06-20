<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;

/**
 * 沙箱网关通用结果类
 * 统一处理网关API响应
 */
class GatewayResult
{
    public function __construct(
        private int $code,
        private string $message,
        private array $data = []
    ) {}

    /**
     * 创建成功结果
     */
    public static function success(array $data = [], string $message = 'Success'): self
    {
        return new self(ResponseCode::SUCCESS, $message, $data);
    }

    /**
     * 创建失败结果
     */
    public static function error(string $message, array $data = []): self
    {
        return new self(ResponseCode::ERROR, $message, $data);
    }

    /**
     * 从API响应创建结果
     */
    public static function fromApiResponse(array $response): self
    {
        $code = $response['code'] ?? ResponseCode::ERROR;
        $message = $response['message'] ?? 'Unknown error';
        $data = $response['data'] ?? [];

        return new self($code, $message, $data);
    }

    /**
     * 检查是否成功
     */
    public function isSuccess(): bool
    {
        return ResponseCode::isSuccess($this->code);
    }

    /**
     * 检查是否失败
     */
    public function isError(): bool
    {
        return ResponseCode::isError($this->code);
    }

    /**
     * 获取响应码
     */
    public function getCode(): int
    {
        return $this->code;
    }

    /**
     * 获取消息
     */
    public function getMessage(): string
    {
        return $this->message;
    }

    /**
     * 获取数据
     */
    public function getData(): array
    {
        return $this->data;
    }

    /**
     * 获取指定键的数据
     */
    public function getDataValue(string $key, mixed $default = null): mixed
    {
        return $this->data[$key] ?? $default;
    }

    /**
     * 转换为数组
     */
    public function toArray(): array
    {
        return [
            'code' => $this->code,
            'message' => $this->message,
            'data' => $this->data,
        ];
    }
} 