<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Transport\ApiKeyKelingTransport;
use RuntimeException;

readonly class KelingTransportFactory
{
    private const string DEFAULT_TRANSPORT = 'cloudsway_api_key';

    public function __construct(
        private ApiKeyKelingTransport $apiKeyKelingTransport,
    ) {
    }

    public function create(QueueExecutorConfig $config): KelingTransportInterface
    {
        return match (strtolower(trim($config->getExtraString('transport', self::DEFAULT_TRANSPORT)))) {
            self::DEFAULT_TRANSPORT => $this->apiKeyKelingTransport,
            default => throw new RuntimeException('unsupported keling transport'),
        };
    }
}
