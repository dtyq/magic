<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Result\ChatBot;

use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidResultException;
use Dtyq\EasyDingTalk\OpenDev\Result\AbstractResult;

class DownloadFileResult extends AbstractResult
{
    private string $downloadUrl;

    public function buildByRawData(array $rawData): void
    {
        if (! isset($rawData['downloadUrl'])) {
            throw new InvalidResultException('downloadUrl not empty');
        }
        $this->downloadUrl = $rawData['downloadUrl'];
    }

    public function getDownloadUrl(): string
    {
        return $this->downloadUrl;
    }
}
