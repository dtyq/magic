<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Authentication\Entity\ValueObject;

enum Code: string
{
    case ApiKeyProvider = 'AKP';
    case ApiKeySK = 'api-sk';

    public function gen(): string
    {
        return $this->value . '-' . str_replace('.', '-', uniqid('', true));
    }
}
