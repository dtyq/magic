<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Speech\Entity\Dto;

use App\Domain\ModelGateway\Entity\Dto\AbstractRequestDTO;

class SpeechSubmitDTO extends AbstractRequestDTO
{
    protected ?SpeechUserDTO $user = null;

    protected SpeechAudioDTO $audio;

    protected ?array $additions = null;

    public function __construct(array $data = [])
    {
        parent::__construct($data);

        // 初始化音频配置
        $this->audio = new SpeechAudioDTO($data['audio'] ?? []);

        // 初始化附加配置
        if (isset($data['additions'])) {
            $this->additions = $data['additions'];
        }
    }

    public function getUser(): SpeechUserDTO
    {
        return $this->user;
    }

    public function setUser(null|array|SpeechUserDTO $user): void
    {
        if (is_array($user)) {
            $user = new SpeechUserDTO($user);
        }
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

    public function getAdditions(): ?array
    {
        return $this->additions;
    }

    public function setAdditions(?array $additions): void
    {
        $this->additions = $additions;
    }

    /**
     * 生成完整的火山引擎请求参数（不包含app字段，app字段由基础设施层组装）.
     */
    public function toVolcengineRequestData(): array
    {
        $requestData = [
            'user' => $this->user->toArray(),
            'audio' => $this->audio->toArray(),
        ];

        // 添加可选的附加配置
        if ($this->additions) {
            $requestData['additions'] = $this->additions;
        }

        return $requestData;
    }

    public function getType(): string
    {
        return 'speech_submit';
    }

    public function getCallMethod(): string
    {
        return 'speech_submit';
    }
}
