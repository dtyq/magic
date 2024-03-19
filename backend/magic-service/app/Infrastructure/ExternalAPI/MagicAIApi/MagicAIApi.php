<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\MagicAIApi;

use Dtyq\SdkBase\SdkBase;
use Dtyq\SdkBase\SdkBaseContext;
use RuntimeException;

/**
 * @property Api\Chat $chat
 */
class MagicAIApi
{
    public const string NAME = 'magic_ai';

    protected array $routes = [
        'chat' => Api\Chat::class,
    ];

    protected array $fetchedDefinitions = [];

    public function __construct(SdkBase $container)
    {
        if (! SdkBaseContext::has(self::NAME)) {
            SdkBaseContext::register(self::NAME, $container);
        }
        $this->register($container);
    }

    public function __get(string $name)
    {
        $api = $this->fetchedDefinitions[$name] ?? null;
        if (! $api) {
            throw new RuntimeException("no allowed route [{$name}]");
        }
        return $api;
    }

    protected function register(SdkBase $container): void
    {
        foreach ($this->routes as $key => $route) {
            $this->fetchedDefinitions[$key] = new $route($container);
        }
    }
}
