<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Result;

abstract class AbstractResult
{
    /**
     * 原始数据.
     */
    private array $rawData;

    public function __construct(array $rawData = [])
    {
        $this->rawData = $rawData;
        $this->buildByRawData($rawData);
    }

    public function getRawData(): array
    {
        return $this->rawData;
    }

    public function getJsonRawData(): string
    {
        return json_encode($this->rawData, JSON_UNESCAPED_UNICODE);
    }

    abstract public function buildByRawData(array $rawData): void;
}
