<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\StreamMessage;

use App\Domain\Chat\Entity\AbstractEntity;

class StreamOptions extends AbstractEntity
{
    protected ?StreamMessageStatus $status;

    protected bool $stream;

    // 用于标识流式消息的关联性。多段流式消息的 stream_app_message_id 相同
    // ai 搜索卡片消息的多段响应，已经将 app_message_id 作为关联 id，流式响应需要另外的 id 来做关联
    protected string $streamAppMessageId;

    /**
     * 消息应用选项：0:覆盖 1：追加（字符串就拼接，数组就插入）.
     */
    protected MessageAppendOptions $append;

    /**
     * 问题搜索结束的标识，用于前端渲染结束动画。或者推送异常信息。
     * @var StepFinishedDTO[]
     */
    protected array $stepsFinished;

    public function getStreamAppMessageId(): ?string
    {
        return $this->streamAppMessageId ?? null;
    }

    public function setStreamAppMessageId(?string $streamAppMessageId): static
    {
        $this->streamAppMessageId = $streamAppMessageId;
        return $this;
    }

    // 消息是否是流式消息
    public function isStream(): bool
    {
        return $this->stream ?? true;
    }

    public function setStream(bool $stream): static
    {
        $this->stream = $stream;
        return $this;
    }

    public function getStatus(): ?StreamMessageStatus
    {
        return $this->status ?? null;
    }

    public function setStatus(null|int|StreamMessageStatus|string $status): static
    {
        if (is_numeric($status)) {
            $this->status = StreamMessageStatus::from((int) $status);
        } elseif ($status instanceof StreamMessageStatus) {
            $this->status = $status;
        }
        return $this;
    }

    public function getAppend(): MessageAppendOptions
    {
        return $this->append ?? MessageAppendOptions::Append;
    }

    public function setAppend(int|MessageAppendOptions|string $append): void
    {
        if ($append instanceof MessageAppendOptions) {
            $this->append = $append;
        } else {
            $this->append = MessageAppendOptions::from((int) $append);
        }
    }

    /**
     * @return StepFinishedDTO[]
     */
    public function getStepsFinished(): array
    {
        return $this->stepsFinished;
    }

    /**
     * @param StepFinishedDTO[] $stepsFinished
     */
    public function setStepsFinished(array $stepsFinished): void
    {
        $this->stepsFinished = $stepsFinished;
    }
}
