<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Entity\ValueObject\VoiceTranscription;

class VoiceMessage extends FileMessage
{
    /**
     * 语音转文字结果.
     */
    protected ?VoiceTranscription $transcription;

    /**
     * 语音时长（秒）.
     */
    protected ?int $duration;

    /**
     * 获取语音转文字结果.
     */
    public function getTranscription(): ?VoiceTranscription
    {
        return $this->transcription ?? null;
    }

    /**
     * 设置语音转文字结果.
     */
    public function setTranscription(null|array|VoiceTranscription $transcription): self
    {
        if ($transcription instanceof VoiceTranscription) {
            $this->transcription = $transcription;
        } elseif (is_array($transcription)) {
            $this->transcription = VoiceTranscription::fromArray($transcription);
        } else {
            $this->transcription = null;
        }
        return $this;
    }

    /**
     * 检查是否有转录结果.
     */
    public function hasTranscription(): bool
    {
        return $this->transcription !== null && ! $this->transcription->isEmpty();
    }

    /**
     * 获取指定语言的转录文本.
     */
    public function getTranscriptionText(string $language): ?string
    {
        return $this->transcription?->getTranscription($language);
    }

    /**
     * 获取主要语言的转录文本.
     */
    public function getPrimaryTranscriptionText(): ?string
    {
        return $this->transcription?->getPrimaryTranscription();
    }

    /**
     * 添加转录结果.
     */
    public function addTranscription(string $language, string $text): self
    {
        if ($this->transcription === null) {
            $this->transcription = new VoiceTranscription();
        }
        $this->transcription->addTranscription($language, $text);
        return $this;
    }

    /**
     * 获取转录错误信息.
     */
    public function getTranscriptionError(): ?string
    {
        return $this->transcription?->getErrorMessage();
    }

    /**
     * 获取语音时长
     */
    public function getDuration(): ?int
    {
        return $this->duration;
    }

    /**
     * 设置语音时长
     */
    public function setDuration(?int $duration): self
    {
        $this->duration = $duration;
        return $this;
    }

    /**
     * 创建一个新的转录对象
     */
    public function createTranscription(array $data = []): VoiceTranscription
    {
        $this->transcription = new VoiceTranscription($data);
        return $this->transcription;
    }

    /**
     * 获取所有支持的转录语言
     * @return string[]
     */
    public function getTranscriptionLanguages(): array
    {
        return $this->transcription?->getSupportedLanguages() ?? [];
    }

    /**
     * 检查是否支持指定语言的转录.
     */
    public function hasTranscriptionForLanguage(string $language): bool
    {
        return $this->transcription?->hasTranscription($language) ?? false;
    }

    protected function setMessageType(): void
    {
        $this->chatMessageType = ChatMessageType::Voice;
    }
}
