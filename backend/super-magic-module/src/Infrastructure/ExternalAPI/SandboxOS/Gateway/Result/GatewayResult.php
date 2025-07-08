<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;
use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;

/**
 * Sandbox Gateway Common Result Class
 * Unified handling of gateway API responses.
 */
class GatewayResult
{
    public function __construct(
        private int $code,
        private string $message,
        private array $data = []
    ) {
    }

    /**
     * Create success result.
     */
    public static function success(array $data = [], string $message = 'Success'): self
    {
        return new self(ResponseCode::SUCCESS, $message, $data);
    }

    /**
     * Create failure result.
     */
    public static function error(string $message, array $data = []): self
    {
        return new self(ResponseCode::ERROR, $message, $data);
    }

    /**
     * Create result from API response.
     */
    public static function fromApiResponse(array $response): self
    {
        $code = $response['code'] ?? ResponseCode::ERROR;
        $message = $response['message'] ?? 'Unknown error';
        $data = $response['data'] ?? [];

        // 智能处理嵌套的JSON字符串
        if (is_string($data) && json_validate($data)) {
            $data = json_decode($data, true);
        }

        // 添加调试日志，追踪数据处理过程
        if (class_exists(LoggerFactory::class)) {
            $logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get('sandbox');
            $logger->info('[GatewayResult] Processing API response', [
                'original_response' => $response,
                'extracted_code' => $code,
                'extracted_message' => $message,
                'extracted_data' => $data,
                'data_type' => gettype($data),
            ]);
        }

        return new self($code, $message, $data);
    }

    /**
     * Check if successful.
     */
    public function isSuccess(): bool
    {
        return ResponseCode::isSuccess($this->code);
    }

    /**
     * Check if failed.
     */
    public function isError(): bool
    {
        return ResponseCode::isError($this->code);
    }

    /**
     * Get response code.
     */
    public function getCode(): int
    {
        return $this->code;
    }

    /**
     * Get message.
     */
    public function getMessage(): string
    {
        return $this->message;
    }

    /**
     * Get data.
     */
    public function getData(): array
    {
        return $this->data;
    }

    /**
     * Get data value by specified key.
     */
    public function getDataValue(string $key, mixed $default = null): mixed
    {
        return $this->data[$key] ?? $default;
    }

    /**
     * Convert to array.
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
