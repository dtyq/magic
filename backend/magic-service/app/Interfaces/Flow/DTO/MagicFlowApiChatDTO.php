<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\DTO;

use App\Domain\Chat\DTO\Message\ChatMessage\Item\InstructionValue;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class MagicFlowApiChatDTO extends AbstractFlowDTO
{
    public string $message = '';

    public string $conversationId = '';

    public array $attachments = [];

    public string $version = 'v0';

    public array $params = [];

    /**
     * 指令列表.
     *
     * @var InstructionValue[]
     */
    public array $instruction = [];

    public bool $async = false;

    public bool $stream = false;

    public string $environmentCode = '';

    public string $organizationCode = '';

    public string $flowCode = '';

    public string $flowVersionCode = '';

    public string $apiKey = '';

    public string $authorization = '';

    public string $taskId = '';

    private array $shareOptions = [];

    public function validate(bool $checkInput = true): void
    {
        if (empty($this->apiKey) && empty($this->authorization)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'api-key or authorization is required');
        }

        if ($checkInput) {
            if ($this->getMessage() === '' && empty($this->getAttachments())) {
                ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'message or attachments is required');
            }
        }
    }

    public function getMessage(): string
    {
        return $this->message;
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function getAttachments(): array
    {
        return $this->attachments;
    }

    public function getVersion(): string
    {
        return $this->version;
    }

    public function getParams(): array
    {
        return $this->params;
    }

    /**
     * 获取指令列表.
     *
     * @return InstructionValue[]
     */
    public function getInstruction(): array
    {
        return $this->instruction;
    }

    public function isAsync(): bool
    {
        return $this->async;
    }

    public function isStream(): bool
    {
        return $this->stream;
    }

    public function getEnvironmentCode(): string
    {
        return $this->environmentCode;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getFlowCode(): string
    {
        return $this->flowCode;
    }

    public function getFlowVersionCode(): string
    {
        return $this->flowVersionCode;
    }

    public function getApiKey(): string
    {
        return $this->apiKey;
    }

    public function getAuthorization(): string
    {
        return $this->authorization;
    }

    public function setAsync(?bool $async): void
    {
        $this->async = $async ?? false;
    }

    public function setVersion(?string $version): void
    {
        $this->version = $version ?? 'v0';
    }

    public function setStream(?bool $stream): void
    {
        $this->stream = $stream ?? false;
    }

    public function setMessage(?string $message): void
    {
        $this->message = trim($message ?? '');
    }

    public function setConversationId(?string $conversationId): void
    {
        $this->conversationId = $conversationId ?? '';
    }

    public function setAttachments(?array $attachments): void
    {
        $this->attachments = $attachments ?? [];
    }

    public function setParams(?array $params): void
    {
        $this->params = $params ?? [];
    }

    /**
     * 设置指令列表.
     */
    public function setInstruction(?array $instruction): void
    {
        if ($instruction === null) {
            $this->instruction = [];
            return;
        }

        $InstructionValues = [];
        foreach ($instruction as $item) {
            if ($item instanceof InstructionValue) {
                $InstructionValues[] = $item;
            } else {
                $InstructionValues[] = new InstructionValue($item);
            }
        }
        $this->instruction = $InstructionValues;
    }

    public function setEnvironmentCode(?string $environmentCode): void
    {
        $this->environmentCode = $environmentCode ?? '';
    }

    public function setOrganizationCode(?string $organizationCode): void
    {
        $this->organizationCode = $organizationCode ?? '';
    }

    public function setFlowCode(?string $flowCode): void
    {
        $this->flowCode = $flowCode ?? '';
    }

    public function setFlowVersionCode(?string $flowVersionCode): void
    {
        $this->flowVersionCode = $flowVersionCode ?? '';
    }

    public function setApiKey(?string $apiKey): void
    {
        $this->apiKey = $apiKey ?? '';
    }

    public function setAuthorization(?string $authorization): void
    {
        $this->authorization = $authorization ?? '';
    }

    public function getTaskId(): string
    {
        return $this->taskId;
    }

    public function setTaskId(?string $taskId): void
    {
        $this->taskId = $taskId ?? '';
    }

    public function addShareOptions(string $key, mixed $data): void
    {
        $this->shareOptions[$key] = $data;
    }

    public function getShareOptions(string $key, mixed $default = null): mixed
    {
        return $this->shareOptions[$key] ?? $default;
    }
}
