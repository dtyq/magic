<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Parameter\ChatBot;

use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidParameterException;
use Dtyq\EasyDingTalk\OpenDev\Parameter\AbstractParameter;

class DownloadFileParameter extends AbstractParameter
{
    private string $robotCode;

    private string $downloadCode;

    public function getRobotCode(): string
    {
        return $this->robotCode;
    }

    public function setRobotCode(string $robotCode): void
    {
        $this->robotCode = $robotCode;
    }

    public function getDownloadCode(): string
    {
        return $this->downloadCode;
    }

    public function setDownloadCode(string $downloadCode): void
    {
        $this->downloadCode = $downloadCode;
    }

    protected function validateParams(): void
    {
        if (empty($this->robotCode)) {
            throw new InvalidParameterException('robotCode is required');
        }
        if (empty($this->downloadCode)) {
            throw new InvalidParameterException('downloadCode is required');
        }
    }
}
