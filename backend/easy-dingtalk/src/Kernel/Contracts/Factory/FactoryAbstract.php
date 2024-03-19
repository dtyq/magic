<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Kernel\Contracts\Factory;

use Dtyq\EasyDingTalk\Kernel\Contracts\Endpoint\Endpoint;
use Dtyq\EasyDingTalk\Kernel\Contracts\Endpoint\EndpointInterface;
use Dtyq\EasyDingTalk\Kernel\Exceptions\SystemException;
use Dtyq\SdkBase\SdkBase;

abstract class FactoryAbstract
{
    private array $fetchedDefinitions = [];

    public function __construct(string $appName, SdkBase $sdkBase)
    {
        $this->register($appName, $sdkBase);
    }

    /**
     * @throws SystemException
     */
    public function __get(string $name)
    {
        $provider = $this->fetchedDefinitions[$name] ?? null;
        if (! $provider) {
            throw new SystemException("no allowed provider [{$name}]");
        }
        return $provider;
    }

    abstract protected function getEndpoints(): array;

    protected function register(string $appName, SdkBase $sdkBase): void
    {
        foreach ($this->getEndpoints() as $key => $endpointClass) {
            if ($endpointClass instanceof Endpoint) {
                $endpoint = $endpointClass;
            } else {
                if (! is_string($endpointClass) || ! class_exists($endpointClass)) {
                    continue;
                }
                $implements = class_implements($endpointClass);
                if (! in_array(EndpointInterface::class, $implements)) {
                    continue;
                }
                $endpoint = new $endpointClass($sdkBase);
            }
            if (is_integer($key)) {
                $key = lcfirst(class_basename($endpointClass));
            }
            $endpoint->selectApp($appName);

            $this->fetchedDefinitions[$key] = $endpoint;
        }
    }
}
