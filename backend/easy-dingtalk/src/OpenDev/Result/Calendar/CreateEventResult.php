<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Result\Calendar;

use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidResultException;
use Dtyq\EasyDingTalk\OpenDev\Result\AbstractResult;

class CreateEventResult extends AbstractResult
{
    private string $id;

    private string $summary;

    public function buildByRawData(array $rawData): void
    {
        if (empty($rawData['id'])) {
            throw new InvalidResultException('id 不能为空');
        }
        if (empty($rawData['summary'])) {
            throw new InvalidResultException('summary 不能为空');
        }
        $this->id = $rawData['id'];
        $this->summary = $rawData['summary'];
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getSummary(): string
    {
        return $this->summary;
    }
}
