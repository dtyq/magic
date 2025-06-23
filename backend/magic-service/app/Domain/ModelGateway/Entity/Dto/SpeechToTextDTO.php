<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

class SpeechToTextDTO extends AbstractRequestDTO
{
    /**
     * Audio file URL.
     */
    protected string $audioUrl;

    public function getAudioUrl(): string
    {
        return $this->audioUrl;
    }

    public function setAudioUrl(string $audioUrl): void
    {
        $this->audioUrl = $audioUrl;
    }

    public function getType(): string
    {
        return 'speech_to_text';
    }

    public function getModel(): string
    {
        return $this->model ?? 'whisper-1';
    }

    public function getIps(): array
    {
        return $this->ips;
    }

    public function getAccessToken(): string
    {
        return $this->accessToken;
    }

    public function getCallMethod(): string
    {
        return $this->callMethod ?? 'speech_to_text';
    }

    public function getHeaderConfig(string $key, mixed $default = null): mixed
    {
        return $this->headerConfigs[$key] ?? $default;
    }
}
