<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\FlowExprEngine\Hyperf;

use GuzzleHttp\Client;
use Psr\Container\ContainerInterface;
use Psr\Http\Client\ClientInterface;

class SimpleClientFactory
{
    public function __invoke(ContainerInterface $container): ClientInterface
    {
        return new Client();
    }
}
