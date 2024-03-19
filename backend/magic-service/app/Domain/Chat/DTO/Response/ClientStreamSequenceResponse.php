<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Response;

use App\Domain\Chat\DTO\Message\StreamMessage\StreamMessageStatus;
use App\Domain\Chat\Entity\AbstractEntity;
use Hyperf\Codec\Json;

class ClientStreamSequenceResponse extends AbstractEntity
{
    // 要更新目标 seqId 的内容
    protected string $targetSeqId;

    // 为了实现丢包重传，需要记录当前的seqId。一定单调递增。
    protected ?int $seqId;

    // 大模型的总结
    protected ?string $content;

    // 有些消息的大模型响应字段不是 content，这里特殊处理
    protected ?string $llmResponse;

    // 大模型的推理内容
    protected ?string $reasoningContent;

    protected StreamMessageStatus $status;

    public function getStatus(): StreamMessageStatus
    {
        return $this->status;
    }

    public function setStatus(StreamMessageStatus $status): self
    {
        $this->status = $status;
        return $this;
    }

    public function getTargetSeqId(): string
    {
        return $this->targetSeqId;
    }

    public function setTargetSeqId(string $targetSeqId): self
    {
        $this->targetSeqId = $targetSeqId;
        return $this;
    }

    public function getSeqId(): int
    {
        return $this->seqId;
    }

    public function setSeqId(?int $seqId): self
    {
        $this->seqId = $seqId;
        return $this;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function setContent(?string $content): self
    {
        $this->content = $content;
        return $this;
    }

    public function getReasoningContent(): string
    {
        return $this->reasoningContent ?? '';
    }

    public function setReasoningContent(?string $reasoningContent): self
    {
        $this->reasoningContent = $reasoningContent;
        return $this;
    }

    public function getLlmResponse(): string
    {
        return $this->llmResponse;
    }

    public function setLlmResponse(?string $llmResponse): self
    {
        $this->llmResponse = $llmResponse;
        return $this;
    }

    public function toArray(bool $filterNull = false): array
    {
        $data = Json::decode($this->toJsonString());
        if ($filterNull) {
            $data = array_filter($data, static fn ($value) => $value !== null);
        }
        return $data;
    }
}
