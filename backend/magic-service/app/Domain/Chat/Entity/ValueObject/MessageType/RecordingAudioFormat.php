<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject\MessageType;

use App\Infrastructure\Core\AbstractValueObject;

class RecordingAudioFormat extends AbstractValueObject
{
    protected string $format;

    protected string $codec;

    protected int $sampleRate;

    protected int $bitRate;

    protected int $channels;

    protected string $duration;

    protected string $size;

    protected string $fileKey;

    public function __construct(
        string $format,
        string $codec,
        int $sampleRate,
        int $bitRate,
        int $channels,
        string $duration,
        string $size,
        string $fileKey,
    ) {
        $this->format = $format;
        $this->codec = $codec;
        $this->sampleRate = $sampleRate;
        $this->bitRate = $bitRate;
        $this->channels = $channels;
        $this->duration = $duration;
        $this->size = $size;
        $this->fileKey = $fileKey;
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

    public function getSampleRate(): int
    {
        return $this->sampleRate;
    }

    public function setSampleRate(int $sampleRate): void
    {
        $this->sampleRate = $sampleRate;
    }

    public function getBitRate(): int
    {
        return $this->bitRate;
    }

    public function setBitRate(int $bitRate): void
    {
        $this->bitRate = $bitRate;
    }

    public function getChannels(): int
    {
        return $this->channels;
    }

    public function setChannels(int $channels): void
    {
        $this->channels = $channels;
    }

    public function getDuration(): string
    {
        return $this->duration;
    }

    public function setDuration(string $duration): void
    {
        $this->duration = $duration;
    }

    public function getSize(): string
    {
        return $this->size;
    }

    public function setSize(string $size): void
    {
        $this->size = $size;
    }
}
