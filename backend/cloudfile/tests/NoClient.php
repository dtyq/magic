<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests;

use GuzzleHttp\Psr7\Response;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

class NoClient implements ClientInterface
{
    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        return new Response(200, [], 'success');
    }
}
