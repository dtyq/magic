<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\HttpServer\Contract\RequestInterface;

class DeliverMessageRequestDTO
{
    /**
     * 构造函数.
     *
     * @param array $metadata 元数据
     * @param array $payload 消息载荷
     */
    public function __construct(
        private array $metadata,
        private array $payload
    ) {
    }

    /**
     * 从HTTP请求创建DTO.
     *
     * @param RequestInterface $request HTTP请求
     */
    public static function fromRequest(RequestInterface $request): self
    {
        $requestData = $request->all();
        if (empty($requestData)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'message_required');
        }

        // 验证请求包含必要的metadata和payload字段
        if (! isset($requestData['metadata']) || ! isset($requestData['payload'])) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'metadata_and_payload_required');
        }

        return new self($requestData['metadata'], $requestData['payload']);
    }

    /**
     * 获取元数据.
     */
    public function getMetadata(): array
    {
        return $this->metadata;
    }

    /**
     * 设置元数据.
     *
     * @param array $metadata 元数据
     */
    public function setMetadata(array $metadata): self
    {
        $this->metadata = $metadata;
        return $this;
    }

    /**
     * 获取消息载荷.
     */
    public function getPayload(): array
    {
        return $this->payload;
    }

    /**
     * 设置消息载荷.
     *
     * @param array $payload 消息载荷
     */
    public function setPayload(array $payload): self
    {
        $this->payload = $payload;
        return $this;
    }
}
