<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Speech\Entity\Dto;

use App\Domain\ModelGateway\Entity\Dto\AbstractRequestDTO;

class FlashSpeechSubmitDTO extends AbstractRequestDTO
{
    protected ?SpeechUserDTO $user = null;

    protected SpeechAudioDTO $audio;

    protected ?array $request = null;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getUser(): ?SpeechUserDTO
    {
        return $this->user;
    }

    public function setUser(?SpeechUserDTO $user): void
    {
        $this->user = $user;
    }

    public function getAudio(): SpeechAudioDTO
    {
        return $this->audio;
    }

    public function setAudio(array|SpeechAudioDTO $audio): void
    {
        if (is_array($audio)) {
            $audio = new SpeechAudioDTO($audio);
        }
        $this->audio = $audio;
    }

    public function getRequest(): ?array
    {
        return $this->request;
    }

    public function setRequest(?array $request): void
    {
        $this->request = $request;
    }

    public function getType(): string
    {
        return 'speech_asr_flash';
    }

    public function toVolcenArray(): array
    {
        return [
            'user' => $this->user->toArray(),
            'request' => $this->request ?? ['model_name' => 'bigmodel'],
            'audio' => $this->audio->toArray(),
        ];
    }
}
