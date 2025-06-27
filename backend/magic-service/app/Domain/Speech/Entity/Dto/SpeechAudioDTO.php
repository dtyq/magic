<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Speech\Entity\Dto;

use App\Domain\Chat\Entity\AbstractEntity;

class SpeechAudioDTO extends AbstractEntity
{
    /**
     * 音频文件URL.
     */
    protected string $url = '';

    /**
     * 音频容器格式: raw / wav / ogg / mp3 / mp4.
     */
    protected string $format = '';

    /**
     * 音频编码格式: raw / opus.
     */
    protected string $codec = '';

    /**
     * 音频采样率.
     */
    protected int $rate = 0;

    /**
     * 音频采样点位数.
     */
    protected int $bits = 0;

    /**
     * 音频声道数: 1(mono) / 2(stereo).
     */
    protected int $channel = 0;

    public function __construct(array $data = [])
    {
        parent::__construct($data);

        $this->url = (string) ($data['url'] ?? '');
        $this->format = (string) ($data['format'] ?? '');
        $this->codec = (string) ($data['codec'] ?? '');
        $this->rate = (int) ($data['rate'] ?? 0);
        $this->bits = (int) ($data['bits'] ?? 0);
        $this->channel = (int) ($data['channel'] ?? 0);
    }

    public function getUrl(): string
    {
        return $this->url;
    }

    public function setUrl(string $url): void
    {
        $this->url = $url;
    }

    public function getFormat(): string
    {
        return $this->format;
    }

    public function setFormat(string $format): void
    {
        $this->format = $format;
    }

    public function getCodec(): string
    {
        return $this->codec;
    }

    public function setCodec(string $codec): void
    {
        $this->codec = $codec;
    }

    public function getRate(): int
    {
        return $this->rate;
    }

    public function setRate(int $rate): void
    {
        $this->rate = $rate;
    }

    public function getBits(): int
    {
        return $this->bits;
    }

    public function setBits(int $bits): void
    {
        $this->bits = $bits;
    }

    public function getChannel(): int
    {
        return $this->channel;
    }

    public function setChannel(int $channel): void
    {
        $this->channel = $channel;
    }

    public function toArray(): array
    {
        $result = [];

        if ($this->url) {
            $result['url'] = $this->url;
        }
        if ($this->format) {
            $result['format'] = $this->format;
        }
        if ($this->codec) {
            $result['codec'] = $this->codec;
        }
        if ($this->rate > 0) {
            $result['rate'] = $this->rate;
        }
        if ($this->bits > 0) {
            $result['bits'] = $this->bits;
        }
        if ($this->channel > 0) {
            $result['channel'] = $this->channel;
        }

        return $result;
    }
}
