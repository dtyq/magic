<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Speech\Entity\Dto;

use App\Domain\ModelGateway\Entity\Dto\AbstractRequestDTO;

class SpeechSubmitDTO extends AbstractRequestDTO
{
    /**
     * 用户配置.
     */
    protected SpeechUserDTO $user;

    /**
     * 音频配置.
     */
    protected SpeechAudioDTO $audio;

    /**
     * 附加配置（可选）.
     */
    protected ?SpeechAdditionsDTO $additions = null;

    public function __construct(array $data = [])
    {
        parent::__construct($data);

        // 初始化用户配置
        $this->user = new SpeechUserDTO($data['user'] ?? []);

        // 初始化音频配置
        $this->audio = new SpeechAudioDTO($data['audio'] ?? []);

        // 初始化附加配置
        if (isset($data['additions'])) {
            $this->additions = new SpeechAdditionsDTO($data['additions']);
        }
    }

    public function getUser(): SpeechUserDTO
    {
        return $this->user;
    }

    public function setUser(SpeechUserDTO $user): void
    {
        $this->user = $user;
    }

    public function getAudio(): SpeechAudioDTO
    {
        return $this->audio;
    }

    public function setAudio(SpeechAudioDTO $audio): void
    {
        $this->audio = $audio;
    }

    public function getAdditions(): ?SpeechAdditionsDTO
    {
        return $this->additions;
    }

    public function setAdditions(?SpeechAdditionsDTO $additions): void
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
            $additions = $this->additions->toArray();
            if (! empty($additions)) {
                $requestData['additions'] = $additions;
            }
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
