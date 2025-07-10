<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;

/**
 * 语音转文字结果值对象
 * 支持多语言转录结果存储.
 */
class VoiceTranscription extends AbstractValueObject
{
    /**
     * 多语言转录结果
     * 格式: ['zh_CN' => '转录文本', 'en_US' => 'Transcription text', ...].
     * @var null|array<string, string>
     */
    private ?array $transcriptions;

    /**
     * 错误信息（如果转录失败）.
     */
    private ?string $errorMessage;

    /**
     * 转录时间戳.
     */
    private ?int $transcribedAt;

    /**
     * 主要语言代码（默认转录语言）.
     */
    private ?string $primaryLanguage;

    /**
     * 获取所有转录结果.
     * @return array<string, string>
     */
    public function getTranscriptions(): array
    {
        return $this->transcriptions ?? [];
    }

    /**
     * 设置转录结果.
     * @param array<string, string> $transcriptions
     */
    public function setTranscriptions(array $transcriptions): self
    {
        $this->transcriptions = $transcriptions;
        return $this;
    }

    /**
     * 添加单个语言的转录结果.
     */
    public function addTranscription(string $language, string $text): self
    {
        if ($this->transcriptions === null) {
            $this->transcriptions = [];
        }
        $this->transcriptions[$language] = $text;
        return $this;
    }

    /**
     * 获取指定语言的转录结果.
     */
    public function getTranscription(string $language): ?string
    {
        return $this->transcriptions !== null ? ($this->transcriptions[$language] ?? null) : null;
    }

    /**
     * 获取主要语言的转录结果.
     */
    public function getPrimaryTranscription(): ?string
    {
        if ($this->primaryLanguage !== null && $this->transcriptions !== null && isset($this->transcriptions[$this->primaryLanguage])) {
            return $this->transcriptions[$this->primaryLanguage];
        }

        // 如果没有设置主要语言，返回第一个可用的转录结果
        return ! empty($this->transcriptions) ? reset($this->transcriptions) : null;
    }

    /**
     * 检查是否有指定语言的转录结果.
     */
    public function hasTranscription(string $language): bool
    {
        return $this->transcriptions !== null && isset($this->transcriptions[$language]) && ! empty($this->transcriptions[$language]);
    }

    /**
     * 获取所有支持的语言代码
     * @return string[]
     */
    public function getSupportedLanguages(): array
    {
        return array_keys($this->transcriptions ?? []);
    }

    /**
     * 获取错误信息.
     */
    public function getErrorMessage(): ?string
    {
        return $this->errorMessage ?? null;
    }

    /**
     * 设置错误信息.
     */
    public function setErrorMessage(?string $errorMessage): self
    {
        $this->errorMessage = $errorMessage;
        return $this;
    }

    /**
     * 获取转录时间戳.
     */
    public function getTranscribedAt(): ?int
    {
        return $this->transcribedAt ?? null;
    }

    /**
     * 设置转录时间戳.
     */
    public function setTranscribedAt(?int $transcribedAt): self
    {
        $this->transcribedAt = $transcribedAt;
        return $this;
    }

    /**
     * 获取主要语言代码
     */
    public function getPrimaryLanguage(): ?string
    {
        return $this->primaryLanguage ?? null;
    }

    /**
     * 设置主要语言代码
     */
    public function setPrimaryLanguage(?string $primaryLanguage): self
    {
        $this->primaryLanguage = $primaryLanguage;
        return $this;
    }

    /**
     * 从数组创建实例.
     */
    public static function fromArray(array $data): self
    {
        return new self($data);
    }

    /**
     * 检查是否为空（没有任何转录结果）.
     */
    public function isEmpty(): bool
    {
        return empty($this->transcriptions);
    }

    /**
     * 清空所有转录结果.
     */
    public function clear(): self
    {
        $this->transcriptions = null;
        $this->errorMessage = null;
        $this->transcribedAt = null;
        return $this;
    }
}
