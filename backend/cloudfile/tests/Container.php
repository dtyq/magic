<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\CloudFile\Tests;

use GuzzleHttp\Client;
use Psr\Container\ContainerInterface;
use Psr\Http\Client\ClientInterface;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;

class Container implements ContainerInterface
{
    private array $class = [];

    public function get(string $id)
    {
        if (isset($this->class[$id])) {
            return $this->class[$id];
        }
        switch ($id) {
            case ClientInterface::class:
                return new Client();
            case LoggerInterface::class:
                return new EchoLogger();
            case CacheInterface::class:
                return new NoCache();
            default:
        }
        return null;
    }

    public function set(string $id, mixed $data): void
    {
        $this->class[$id] = $data;
    }

    public function has(string $id): bool
    {
        return true;
    }
}
