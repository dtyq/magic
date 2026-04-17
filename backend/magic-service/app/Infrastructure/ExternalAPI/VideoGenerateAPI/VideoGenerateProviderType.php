<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use InvalidArgumentException;

enum VideoGenerateProviderType: string
{
    case Cloudsway = 'Cloudsway';
    case VolcengineArk = 'VolcengineArk';

    public static function fromProviderCode(ProviderCode $providerCode, ?string $modelVersion = null): self
    {
        return match ($providerCode) {
            ProviderCode::Cloudsway => self::Cloudsway,
            ProviderCode::VolcengineArk => self::VolcengineArk,
            default => throw new InvalidArgumentException(sprintf(
                'unsupported video provider code %s for model %s',
                $providerCode->value,
                $modelVersion,
            )),
        };
    }
}
