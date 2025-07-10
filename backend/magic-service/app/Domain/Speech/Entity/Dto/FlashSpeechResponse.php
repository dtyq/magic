<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Speech\Entity\Dto;

use App\Infrastructure\Core\AbstractDTO;

class FlashSpeechResponse extends AbstractDTO
{
    protected array $responseData;

    public function __construct(array $responseData)
    {
        // Remove unnecessary utterances detailed data to save memory
        // utterances contains detailed word segmentation information (start time, end time, confidence, etc.), usually only result.text is needed
        if (isset($responseData['result']['utterances'])) {
            unset($responseData['result']['utterances']);
        }

        $this->responseData = $responseData;
        parent::__construct($responseData);
    }

    /**
     * Extract text content from Flash response.
     */
    public function extractTextContent(): string
    {
        // Check response status
        if (isset($this->responseData['code']) && $this->responseData['code'] !== 0) {
            return '';
        }

        // Get complete transcription text from result.text field
        if (isset($this->responseData['result']['text']) && ! empty($this->responseData['result']['text'])) {
            return trim($this->responseData['result']['text']);
        }

        // If no text content found, return empty string
        return '';
    }

    /**
     * Get response status code.
     */
    public function getCode(): int
    {
        return $this->responseData['code'] ?? -1;
    }

    /**
     * Get response message.
     */
    public function getMessage(): string
    {
        return $this->responseData['message'] ?? '';
    }

    /**
     * Check if response is successful.
     */
    public function isSuccess(): bool
    {
        return $this->getCode() === 0;
    }

    /**
     * Get audio duration (milliseconds).
     */
    public function getAudioDuration(): ?int
    {
        // Get duration from audio_info.duration (milliseconds)
        if (isset($this->responseData['audio_info']['duration'])) {
            return (int) $this->responseData['audio_info']['duration'];
        }

        // Backup method: get from result.additions.duration
        if (isset($this->responseData['result']['additions']['duration'])) {
            return (int) $this->responseData['result']['additions']['duration'];
        }

        return null;
    }

    /**
     * Get complete response data.
     */
    public function getResponseData(): array
    {
        return $this->responseData;
    }
}
