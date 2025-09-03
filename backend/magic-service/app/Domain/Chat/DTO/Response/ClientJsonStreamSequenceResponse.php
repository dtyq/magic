<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Response;

use App\Domain\Chat\DTO\Message\StreamMessage\StreamMessageStatus;
use App\Domain\Chat\DTO\Message\StreamMessage\StreamOptions;
use App\Domain\Chat\Entity\AbstractEntity;
use Hyperf\Codec\Json;

/**
 * todo 为了兼容旧版流式消息，需要将 content/reasoning_content/status 字段放到最外层。
 */
class ClientJsonStreamSequenceResponse extends AbstractEntity
{
    // 要更新目标 seqId 的内容
    protected string $targetSeqId;

    // 为了实现丢包重传，需要记录当前的 $streamId。一定单调递增。
    protected ?int $streamId;

    /**
     * 大 json 的流式推送
     */
    protected array $streams;

    protected ?StreamOptions $streamOptions;

    /**
     * @deprecated 为了兼容旧版流式消息，需要将 content/reasoning_content/status/llm_response 字段放到最外层
     */
    protected ?string $content;

    /**
     * @deprecated 为了兼容旧版流式消息，需要将 content/reasoning_content/status/llm_response 字段放到最外层
     */
    protected ?string $reasoningContent;

    /**
     * @deprecated 为了兼容旧版流式消息，需要将 content/reasoning_content/status/llm_response 字段放到最外层
     */
    protected ?int $status;

    /**
     * @deprecated 为了兼容旧版流式消息，需要将 content/reasoning_content/status/llm_response 字段放到最外层
     */
    protected ?string $llmResponse;

    public function getContent(): ?string
    {
        return $this->content ?? null;
    }

    public function setContent(?string $content): self
    {
        $this->content = $content;
        return $this;
    }

    public function getReasoningContent(): ?string
    {
        return $this->reasoningContent ?? null;
    }

    public function setReasoningContent(?string $reasoningContent): self
    {
        $this->reasoningContent = $reasoningContent;
        return $this;
    }

    public function getStatus(): ?int
    {
        return $this->status ?? null;
    }

    public function setStatus(null|int|StreamMessageStatus $status): self
    {
        if ($status instanceof StreamMessageStatus) {
            $status = $status->value;
        }
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

    public function getStreamId(): ?int
    {
        return $this->streamId;
    }

    public function setStreamId(?int $streamId): self
    {
        $this->streamId = $streamId;
        return $this;
    }

    public function getStreams(): array
    {
        return $this->streams;
    }

    public function setStreams(array $streams): self
    {
        $this->streams = $streams;
        return $this;
    }

    public function getStreamOptions(): ?StreamOptions
    {
        return $this->streamOptions ?? null;
    }

    public function setStreamOptions(?StreamOptions $streamOptions): self
    {
        $this->streamOptions = $streamOptions;
        return $this;
    }

    public function getLlmResponse(): ?string
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
            $data = array_filter($data, static fn ($value) => $value !== null && $value !== '');
        }
        return $data;
    }
}
