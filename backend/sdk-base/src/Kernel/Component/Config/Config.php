<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SdkBase\Kernel\Component\Config;

use Adbar\Dot;
use InvalidArgumentException;

class Config extends Dot
{
    public function __construct(array $items = [])
    {
        parent::__construct($items);

        // 检查一些必填项
        if (empty($this->getSdkName())) {
            throw new InvalidArgumentException('Missing Config: sdk_name');
        }
    }

    public function getSdkName(): string
    {
        return $this->get('sdk_name', '');
    }

    public function getRequestTimeout(): int
    {
        return (int) $this->get('request_timeout', 30);
    }
}
