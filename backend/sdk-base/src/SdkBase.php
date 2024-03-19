<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SdkBase;

use Dtyq\SdkBase\Kernel\Component\Client\ClientRequest;
use Dtyq\SdkBase\Kernel\Component\Config\Config;
use Dtyq\SdkBase\Kernel\Component\Exception\ExceptionBuilder;
use Dtyq\SdkBase\Kernel\Component\Logger\LoggerProxy;
use Psr\Container\ContainerInterface;
use Psr\Http\Client\ClientInterface;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;
use RuntimeException;

class SdkBase
{
    private Config $config;

    private ExceptionBuilder $exceptionBuilder;

    private LoggerProxy $logger;

    private ClientInterface $client;

    private ClientRequest $clientRequest;

    private CacheInterface $cache;

    public function __construct(
        private readonly ContainerInterface $container,
        array $configs = [],
    ) {
        $this->registerConfig($configs);
        $this->registerExceptionBuilder();
    }

    public function getConfig(): Config
    {
        return $this->config;
    }

    public function getExceptionBuilder(): ExceptionBuilder
    {
        return $this->exceptionBuilder;
    }

    public function getLogger(): LoggerProxy
    {
        if (! empty($this->logger)) {
            return $this->logger;
        }
        /** @var LoggerInterface $logger */
        $logger = $this->container->get(LoggerInterface::class);
        if (! $logger instanceof LoggerInterface) {
            throw new RuntimeException('Logger Must Be An Instance Of Psr\Log\LoggerInterface');
        }
        $this->logger = new LoggerProxy($this->getConfig()->getSdkName(), $logger);
        return $this->logger;
    }

    public function getClient(): ClientInterface
    {
        if (! empty($this->client)) {
            return $this->client;
        }
        $client = $this->container->get(ClientInterface::class);
        if (! $client instanceof ClientInterface) {
            throw new RuntimeException('Client Must Be An Instance Of Psr\Http\Client\ClientInterface');
        }
        $this->client = $client;
        return $this->client;
    }

    public function getClientRequest(): ClientRequest
    {
        if (! empty($this->clientRequest)) {
            return $this->clientRequest;
        }
        $this->clientRequest = new ClientRequest($this);
        return $this->clientRequest;
    }

    public function getCache(): CacheInterface
    {
        if (! empty($this->cache)) {
            return $this->cache;
        }
        $cache = $this->container->get(CacheInterface::class);
        if (! $cache instanceof CacheInterface) {
            throw new RuntimeException('Cache Must Be An Instance Of Psr\SimpleCache\CacheInterface');
        }
        $this->cache = $cache;
        return $this->cache;
    }

    protected function registerConfig(array $configs): void
    {
        $this->config = new Config($configs);
    }

    protected function registerExceptionBuilder(): void
    {
        $this->exceptionBuilder = new ExceptionBuilder($this);
    }
}
