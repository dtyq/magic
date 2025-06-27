<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Speech\Entity\Dto;

use App\Domain\Chat\Entity\AbstractEntity;

class SpeechAdditionsDTO extends AbstractEntity
{
    /**
     * 识别语言
     */
    protected string $language = '';

    /**
     * 回调地址
     */
    protected string $callbackUrl = '';

    /**
     * 是否启用说话人分离.
     */
    protected string $withSpeakerInfo = '';

    /**
     * 是否返回词级别时间戳.
     */
    protected string $enableWords = '';

    /**
     * 是否启用文本规范化.
     */
    protected string $enableItn = '';

    /**
     * 是否启用电话号码识别.
     */
    protected string $enableItnPhone = '';

    /**
     * 是否启用数字识别.
     */
    protected string $enableItnNumber = '';

    /**
     * 是否启用URL识别.
     */
    protected string $enableItnUrl = '';

    /**
     * 是否启用邮箱识别.
     */
    protected string $enableItnEmail = '';

    /**
     * 是否启用身份证识别.
     */
    protected string $enableItnIdCard = '';

    /**
     * 是否启用标点符号.
     */
    protected string $enablePunctuation = '';

    /**
     * 最大说话人数量.
     */
    protected int $maxSpeakerNum = 0;

    /**
     * 热词.
     */
    protected string $hotWords = '';

    public function __construct(array $data = [])
    {
        parent::__construct($data);

        $this->language = (string) ($data['language'] ?? '');
        $this->callbackUrl = (string) ($data['callback_url'] ?? '');
        $this->withSpeakerInfo = (string) ($data['with_speaker_info'] ?? '');
        $this->enableWords = (string) ($data['enable_words'] ?? '');
        $this->enableItn = (string) ($data['enable_itn'] ?? '');
        $this->enableItnPhone = (string) ($data['enable_itn_phone'] ?? '');
        $this->enableItnNumber = (string) ($data['enable_itn_number'] ?? '');
        $this->enableItnUrl = (string) ($data['enable_itn_url'] ?? '');
        $this->enableItnEmail = (string) ($data['enable_itn_email'] ?? '');
        $this->enableItnIdCard = (string) ($data['enable_itn_id_card'] ?? '');
        $this->enablePunctuation = (string) ($data['enable_punctuation'] ?? '');
        $this->maxSpeakerNum = (int) ($data['max_speaker_num'] ?? 0);
        $this->hotWords = (string) ($data['hot_words'] ?? '');
    }

    public function getLanguage(): string
    {
        return $this->language;
    }

    public function setLanguage(string $language): void
    {
        $this->language = $language;
    }

    public function getCallbackUrl(): string
    {
        return $this->callbackUrl;
    }

    public function setCallbackUrl(string $callbackUrl): void
    {
        $this->callbackUrl = $callbackUrl;
    }

    public function getWithSpeakerInfo(): string
    {
        return $this->withSpeakerInfo;
    }

    public function setWithSpeakerInfo(string $withSpeakerInfo): void
    {
        $this->withSpeakerInfo = $withSpeakerInfo;
    }

    public function getEnableWords(): string
    {
        return $this->enableWords;
    }

    public function setEnableWords(string $enableWords): void
    {
        $this->enableWords = $enableWords;
    }

    public function getEnableItn(): string
    {
        return $this->enableItn;
    }

    public function setEnableItn(string $enableItn): void
    {
        $this->enableItn = $enableItn;
    }

    public function getEnableItnPhone(): string
    {
        return $this->enableItnPhone;
    }

    public function setEnableItnPhone(string $enableItnPhone): void
    {
        $this->enableItnPhone = $enableItnPhone;
    }

    public function getEnableItnNumber(): string
    {
        return $this->enableItnNumber;
    }

    public function setEnableItnNumber(string $enableItnNumber): void
    {
        $this->enableItnNumber = $enableItnNumber;
    }

    public function getEnableItnUrl(): string
    {
        return $this->enableItnUrl;
    }

    public function setEnableItnUrl(string $enableItnUrl): void
    {
        $this->enableItnUrl = $enableItnUrl;
    }

    public function getEnableItnEmail(): string
    {
        return $this->enableItnEmail;
    }

    public function setEnableItnEmail(string $enableItnEmail): void
    {
        $this->enableItnEmail = $enableItnEmail;
    }

    public function getEnableItnIdCard(): string
    {
        return $this->enableItnIdCard;
    }

    public function setEnableItnIdCard(string $enableItnIdCard): void
    {
        $this->enableItnIdCard = $enableItnIdCard;
    }

    public function getEnablePunctuation(): string
    {
        return $this->enablePunctuation;
    }

    public function setEnablePunctuation(string $enablePunctuation): void
    {
        $this->enablePunctuation = $enablePunctuation;
    }

    public function getMaxSpeakerNum(): int
    {
        return $this->maxSpeakerNum;
    }

    public function setMaxSpeakerNum(int $maxSpeakerNum): void
    {
        $this->maxSpeakerNum = $maxSpeakerNum;
    }

    public function getHotWords(): string
    {
        return $this->hotWords;
    }

    public function setHotWords(string $hotWords): void
    {
        $this->hotWords = $hotWords;
    }

    public function toArray(): array
    {
        $result = [];

        if ($this->language) {
            $result['language'] = $this->language;
        }
        if ($this->callbackUrl) {
            $result['callback_url'] = $this->callbackUrl;
        }
        if ($this->withSpeakerInfo) {
            $result['with_speaker_info'] = $this->withSpeakerInfo;
        }
        if ($this->enableWords) {
            $result['enable_words'] = $this->enableWords;
        }
        if ($this->enableItn) {
            $result['enable_itn'] = $this->enableItn;
        }
        if ($this->enableItnPhone) {
            $result['enable_itn_phone'] = $this->enableItnPhone;
        }
        if ($this->enableItnNumber) {
            $result['enable_itn_number'] = $this->enableItnNumber;
        }
        if ($this->enableItnUrl) {
            $result['enable_itn_url'] = $this->enableItnUrl;
        }
        if ($this->enableItnEmail) {
            $result['enable_itn_email'] = $this->enableItnEmail;
        }
        if ($this->enableItnIdCard) {
            $result['enable_itn_id_card'] = $this->enableItnIdCard;
        }
        if ($this->enablePunctuation) {
            $result['enable_punctuation'] = $this->enablePunctuation;
        }
        if ($this->maxSpeakerNum > 0) {
            $result['max_speaker_num'] = $this->maxSpeakerNum;
        }
        if ($this->hotWords) {
            $result['hot_words'] = $this->hotWords;
        }

        return $result;
    }
}
