<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Response;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;

/**
 * Agent响应类
 * 封装Agent API的响应数据
 */
class AgentResponse extends GatewayResult
{
    private ?string $agentId = null;
    private ?string $sessionId = null;
    private ?string $messageId = null;
    private ?string $responseMessage = null;
    private ?string $responseType = null;
    private array $responseMetadata = [];

    /**
     * 从Gateway结果创建Agent响应
     */
    public static function fromGatewayResult(GatewayResult $gatewayResult): self
    {
        $response = new self(
            $gatewayResult->getCode(),
            $gatewayResult->getMessage(),
            $gatewayResult->getData()
        );

        // 解析Agent特定的响应数据
        $data = $gatewayResult->getData();
        $response->parseAgentData($data);

        return $response;
    }

    /**
     * 从API响应创建Agent响应
     */
    public static function fromApiResponse(array $response): self
    {
        $agentResponse = new self(
            $response['code'] ?? 2000,
            $response['message'] ?? 'Unknown error',
            $response['data'] ?? []
        );

        $agentResponse->parseAgentData($response['data'] ?? []);

        return $agentResponse;
    }

    /**
     * 解析Agent特定数据
     */
    private function parseAgentData(array $data): void
    {
        if (isset($data['agent_id'])) {
            $this->agentId = $data['agent_id'];
        }
        if (isset($data['session_id'])) {
            $this->sessionId = $data['session_id'];
        }
        if (isset($data['message_id'])) {
            $this->messageId = $data['message_id'];
        }
        if (isset($data['response'])) {
            $this->responseMessage = $data['response'];
        }
        if (isset($data['response_type'])) {
            $this->responseType = $data['response_type'];
        }
        if (isset($data['metadata']) && is_array($data['metadata'])) {
            $this->responseMetadata = $data['metadata'];
        }
    }

    /**
     * 获取Agent ID
     */
    public function getAgentId(): ?string
    {
        return $this->agentId ?? $this->getDataValue('agent_id');
    }

    /**
     * 获取会话ID
     */
    public function getSessionId(): ?string
    {
        return $this->sessionId ?? $this->getDataValue('session_id');
    }

    /**
     * 获取消息ID
     */
    public function getMessageId(): ?string
    {
        return $this->messageId ?? $this->getDataValue('message_id');
    }

    /**
     * 获取响应消息
     */
    public function getResponseMessage(): ?string
    {
        return $this->responseMessage ?? $this->getDataValue('response');
    }

    /**
     * 获取响应类型
     */
    public function getResponseType(): ?string
    {
        return $this->responseType ?? $this->getDataValue('response_type');
    }

    /**
     * 获取响应元数据
     */
    public function getResponseMetadata(): array
    {
        return $this->responseMetadata ?: ($this->getDataValue('metadata', []));
    }

    /**
     * 获取指定元数据值
     */
    public function getMetadataValue(string $key, mixed $default = null): mixed
    {
        $metadata = $this->getResponseMetadata();
        return $metadata[$key] ?? $default;
    }

    /**
     * 检查是否有响应消息
     */
    public function hasResponseMessage(): bool
    {
        return !empty($this->getResponseMessage());
    }

    /**
     * 检查是否是文本响应
     */
    public function isTextResponse(): bool
    {
        return $this->getResponseType() === 'text';
    }

    /**
     * 检查是否是错误响应
     */
    public function isErrorResponse(): bool
    {
        return $this->getResponseType() === 'error';
    }

    /**
     * 转换为数组（包含Agent特定字段）
     */
    public function toArray(): array
    {
        $baseArray = parent::toArray();
        
        return array_merge($baseArray, [
            'agent_id' => $this->getAgentId(),
            'session_id' => $this->getSessionId(),
            'message_id' => $this->getMessageId(),
            'response_message' => $this->getResponseMessage(),
            'response_type' => $this->getResponseType(),
            'response_metadata' => $this->getResponseMetadata(),
        ]);
    }
} 