<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\Stream;

use App\Infrastructure\Core\Hyperf\EventStream;
use Hyperf\Context\Context;
use Hyperf\HttpMessage\Server\Response;
use Hyperf\HttpServer\Contract\ResponseInterface;

class FlowEventStreamManager
{
    public static function write(string $data): void
    {
        $stream = self::get();
        $stream->write($data);
    }

    public static function get(): EventStream
    {
        $key = 'FlowEventStreamManager::EventStream';
        if (Context::has($key)) {
            return Context::get($key);
        }
        /** @var Response $response */
        $response = di(ResponseInterface::class);
        $eventStream = new EventStream($response->getConnection(), $response);
        Context::set($key, $eventStream);
        return $eventStream;
    }
}
