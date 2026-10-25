<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Speech\Entity\Dto;

use App\Infrastructure\Core\AbstractDTO;
use InvalidArgumentException;

class SpeechAudioDTO extends AbstractDTO
{
    protected string $url = '';

    protected string $format = '';

    protected ?string $codec = null;

    protected ?int $rate = null;

    protected ?int $bits = null;

    protected ?int $channel = null;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
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

    public function getCodec(): ?string
    {
        return $this->codec;
    }

    public function setCodec(?string $codec): void
    {
        $this->codec = $codec;
    }

    public function getRate(): ?int
    {
        return $this->rate;
    }

    public function setRate(?int $rate): void
    {
        $this->rate = $rate;
    }

    public function getBits(): ?int
    {
        return $this->bits;
    }

    public function setBits(?int $bits): void
    {
        $this->bits = $bits;
    }

    public function getChannel(): ?int
    {
        return $this->channel;
    }

    public function setChannel(?int $channel): void
    {
        $this->channel = $channel;
    }

    public function toArray(): array
    {
        if (in_array(strtolower($this->format), ['raw', 'pcm'], true)
            && ($this->rate === null || $this->bits === null || $this->channel === null)) {
            throw new InvalidArgumentException('Raw PCM audio requires rate, bits, and channel');
        }

        // Only send what the caller actually declared. An unknown format is omitted so the
        // vendor detects the container itself instead of receiving an empty declaration.
        return array_filter(
            parent::toArray(),
            static fn (mixed $value): bool => $value !== null && $value !== '',
        );
    }
}
