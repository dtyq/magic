<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Component\Points;

use App\Domain\ModelGateway\Entity\Dto\ProxyModelRequestInterface;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;

class PointComponent implements PointComponentInterface
{
    public function checkPointsSufficient(ProxyModelRequestInterface $proxyModelRequest, ModelGatewayDataIsolation $modelGatewayDataIsolation): void
    {
    }
}
