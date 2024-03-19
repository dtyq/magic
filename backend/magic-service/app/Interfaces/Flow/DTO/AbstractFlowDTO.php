<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\DTO;

use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Kernel\DTO\Traits\OperatorDTOTrait;
use App\Interfaces\Kernel\DTO\Traits\StringIdDTOTrait;
use DateTime;

abstract class AbstractFlowDTO extends AbstractDTO
{
    use OperatorDTOTrait;
    use StringIdDTOTrait;

    public function jsonSerialize(): array
    {
        $json = [];
        /* @phpstan-ignore-next-line */
        foreach ($this as $key => $value) {
            if (is_null($value)) {
                continue;
            }
            $key = $this->getUnCamelizeValueFromCache($key);
            if ($value instanceof DateTime) {
                $value = $value->format('Y-m-d H:i:s');
            }
            $json[$key] = $value;
        }
        return $json;
    }
}
