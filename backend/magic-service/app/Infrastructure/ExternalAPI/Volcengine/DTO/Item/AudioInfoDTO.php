<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Volcengine\DTO\Item;

use App\Infrastructure\Core\AbstractDTO;

/**
 * Audio Info DTO for speech recognition audio information.
 * 对应 JSON 中的 audio_info 对象
 */
class AudioInfoDTO extends AbstractDTO
{
    protected int $duration = 0;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getDuration(): int
    {
        return $this->duration;
    }

    public function setDuration(null|int|string $duration): void
    {
        if ($duration === null) {
            $this->duration = 0;
        } else {
            $this->duration = (int) $duration;
        }
    }
}
