<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Volcengine\DTO;

use App\Infrastructure\Core\AbstractDTO;
use App\Infrastructure\ExternalAPI\Volcengine\DTO\Item\AudioInfoDTO;
use App\Infrastructure\ExternalAPI\Volcengine\DTO\Item\ResultDTO;
use App\Infrastructure\ExternalAPI\Volcengine\ValueObject\VolcengineStatusCode;

/**
 * Speech Recognition Result DTO for complete speech recognition response.
 * 根级别 DTO - 对应完整的 JSON 响应结构.
 */
class SpeechRecognitionResultDTO extends AbstractDTO
{
    protected ?AudioInfoDTO $audioInfo;

    protected ?ResultDTO $result;

    protected string $volcengineLogId;

    protected ?VolcengineStatusCode $volcengineStatusCode;

    protected string $volcengineMessage;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getAudioInfo(): ?AudioInfoDTO
    {
        return $this->audioInfo ?? null;
    }

    public function setAudioInfo(null|array|AudioInfoDTO $audioInfo): void
    {
        if ($audioInfo === null) {
            $this->audioInfo = null;
        } elseif ($audioInfo instanceof AudioInfoDTO) {
            $this->audioInfo = $audioInfo;
        } else {
            $this->audioInfo = new AudioInfoDTO($audioInfo);
        }
    }

    public function getResult(): ?ResultDTO
    {
        return $this->result ?? null;
    }

    public function setResult(null|array|ResultDTO $result): void
    {
        if ($result === null) {
            $this->result = null;
        } elseif ($result instanceof ResultDTO) {
            $this->result = $result;
        } else {
            $this->result = new ResultDTO($result);
        }
    }

    public function getVolcengineLogId(): string
    {
        return $this->volcengineLogId ?? '';
    }

    public function setVolcengineLogId(?string $volcengineLogId): void
    {
        if ($volcengineLogId === null) {
            $this->volcengineLogId = '';
        } else {
            $this->volcengineLogId = $volcengineLogId;
        }
    }

    public function getVolcengineStatusCode(): ?VolcengineStatusCode
    {
        return $this->volcengineStatusCode;
    }

    /**
     * Get volcengine status code as string for backward compatibility.
     */
    public function getVolcengineStatusCodeString(): string
    {
        return $this->volcengineStatusCode->value ?? '';
    }

    public function setVolcengineStatusCode(null|string|VolcengineStatusCode $volcengineStatusCode): void
    {
        if ($volcengineStatusCode === null || $volcengineStatusCode === '') {
            $this->volcengineStatusCode = null;
        } elseif ($volcengineStatusCode instanceof VolcengineStatusCode) {
            $this->volcengineStatusCode = $volcengineStatusCode;
        } else {
            $this->volcengineStatusCode = VolcengineStatusCode::fromString($volcengineStatusCode);
        }
    }

    public function getVolcengineMessage(): string
    {
        return $this->volcengineMessage ?? '';
    }

    public function setVolcengineMessage(?string $volcengineMessage): void
    {
        if ($volcengineMessage === null) {
            $this->volcengineMessage = '';
        } else {
            $this->volcengineMessage = $volcengineMessage;
        }
    }

    /**
     * Check if the recognition was successful.
     */
    public function isSuccess(): bool
    {
        return $this->volcengineStatusCode?->isSuccess() ?? false;
    }

    /**
     * Check if the recognition is in processing state.
     */
    public function isProcessing(): bool
    {
        return $this->volcengineStatusCode?->isProcessing() ?? false;
    }

    /**
     * Check if the recognition failed.
     */
    public function isFailed(): bool
    {
        return $this->volcengineStatusCode?->isFailed() ?? true;
    }

    /**
     * Check if the task needs resubmit (silent audio).
     */
    public function needsResubmit(): bool
    {
        return $this->volcengineStatusCode?->needsResubmit() ?? false;
    }

    /**
     * Get status code description.
     */
    public function getStatusDescription(): string
    {
        return $this->volcengineStatusCode?->getDescription() ?? '';
    }

    /**
     * Get the recognized text directly.
     */
    public function getText(): string
    {
        return $this->result?->getText() ?? '';
    }

    /**
     * Get the audio duration directly.
     */
    public function getDuration(): int
    {
        return $this->audioInfo?->getDuration() ?? 0;
    }

    /**
     * Create from array with proper data structure mapping.
     */
    public static function fromArray(array $data): self
    {
        return new self($data);
    }
}
