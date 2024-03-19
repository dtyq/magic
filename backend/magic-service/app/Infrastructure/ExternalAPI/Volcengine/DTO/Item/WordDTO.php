<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Volcengine\DTO\Item;

use App\Infrastructure\Core\AbstractDTO;

/**
 * Word DTO for speech recognition word information.
 * 对应 JSON 中的 result.utterances[].words[] 数组元素.
 */
class WordDTO extends AbstractDTO
{
    protected int $confidence = 0;

    protected int $endTime = 0;

    protected int $startTime = 0;

    protected string $text = '';

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getConfidence(): int
    {
        return $this->confidence;
    }

    public function setConfidence(null|int|string $confidence): void
    {
        if ($confidence === null) {
            $this->confidence = 0;
        } else {
            $this->confidence = (int) $confidence;
        }
    }

    public function getEndTime(): int
    {
        return $this->endTime;
    }

    public function setEndTime(null|int|string $endTime): void
    {
        if ($endTime === null) {
            $this->endTime = 0;
        } else {
            $this->endTime = (int) $endTime;
        }
    }

    public function getStartTime(): int
    {
        return $this->startTime;
    }

    public function setStartTime(null|int|string $startTime): void
    {
        if ($startTime === null) {
            $this->startTime = 0;
        } else {
            $this->startTime = (int) $startTime;
        }
    }

    public function getText(): string
    {
        return $this->text;
    }

    public function setText(?string $text): void
    {
        if ($text === null) {
            $this->text = '';
        } else {
            $this->text = $text;
        }
    }
}
