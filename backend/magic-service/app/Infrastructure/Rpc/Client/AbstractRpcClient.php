<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Client;

use App\Application\KnowledgeBase\DTO\RpcHttpPassthroughResult;
use App\Infrastructure\Rpc\Annotation\RpcClient;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\JsonRpc\RpcClientManager;
use ReflectionClass;
use ReflectionMethod;
use RuntimeException;

abstract class AbstractRpcClient
{
    protected string $serviceName = '';

    private ?string $resolvedServiceName = null;

    /**
     * @var array<string, string>
     */
    private array $methodMap = [];

    public function __construct(
        protected RpcClientManager $client
    ) {
    }

    /**
     * 发起 RPC 请求（fail-fast）.
     *
     * 连接恢复由 RpcClientManager::keepAliveLoop() 异步负责，
     * 请求线程不做同步重连，连不上时直接抛错。
     */
    protected function callRpc(string $methodName, array $params = []): array
    {
        $rpcMethod = $this->resolveRpcMethod($methodName);
        $result = $this->client->call($rpcMethod, $params);

        if (! is_array($result)) {
            throw new RuntimeException(sprintf('Invalid %s result', $rpcMethod));
        }

        return $result;
    }

    protected function callRpcPassthrough(string $methodName, array $params = []): RpcHttpPassthroughResult
    {
        $rpcMethod = $this->resolveRpcMethod($methodName);
        $result = $this->client->call($rpcMethod, $params);

        if (! is_array($result)) {
            throw new RuntimeException(sprintf('Invalid %s passthrough result', $rpcMethod));
        }

        return RpcHttpPassthroughResult::fromArray($result);
    }

    /**
     * @param array<string, mixed> $target
     * @param array<string, mixed> $source
     */
    protected function copyIfKeyExists(
        array &$target,
        array $source,
        string $sourceKey,
        ?string $targetKey = null,
        ?callable $transform = null,
    ): void {
        if (! array_key_exists($sourceKey, $source)) {
            return;
        }

        $target[$targetKey ?? $sourceKey] = $transform === null
            ? $source[$sourceKey]
            : $transform($source[$sourceKey]);
    }

    private function resolveRpcMethod(string $methodName): string
    {
        if (isset($this->methodMap[$methodName])) {
            return $this->methodMap[$methodName];
        }

        $rpcMethod = $this->resolveRpcMethodByReflection($methodName);
        $this->methodMap[$methodName] = $rpcMethod;
        return $rpcMethod;
    }

    private function resolveRpcMethodByReflection(string $methodName): string
    {
        $ref = new ReflectionMethod($this, $methodName);
        $attrs = $ref->getAttributes(RpcMethod::class);
        if ($attrs !== []) {
            /** @var RpcMethod $annotation */
            $annotation = $attrs[0]->newInstance();
            if (! $annotation->isEnabled()) {
                throw new RuntimeException(sprintf('RPC method disabled: %s', $methodName));
            }
            $methodName = trim($annotation->getName());
            $isFull = $annotation->isFull();
        } else {
            $isFull = false;
        }

        if ($methodName === '') {
            throw new RuntimeException('RPC method name empty');
        }

        if ($isFull) {
            return $methodName;
        }

        $serviceName = $this->getServiceName();
        if ($serviceName === '') {
            return $methodName;
        }

        return $serviceName . '.' . $methodName;
    }

    private function getServiceName(): string
    {
        if ($this->resolvedServiceName !== null) {
            return $this->resolvedServiceName;
        }

        $this->resolvedServiceName = $this->resolveServiceNameFromAnnotation();
        if ($this->resolvedServiceName !== '') {
            return $this->resolvedServiceName;
        }

        $this->resolvedServiceName = $this->serviceName;
        return $this->resolvedServiceName;
    }

    private function resolveServiceNameFromAnnotation(): string
    {
        $ref = new ReflectionClass($this);
        $attrs = $ref->getAttributes(RpcClient::class);
        if ($attrs === []) {
            return '';
        }

        /** @var RpcClient $annotation */
        $annotation = $attrs[0]->newInstance();
        if (! $annotation->isEnabled()) {
            throw new RuntimeException('RPC client disabled');
        }

        return trim($annotation->getName());
    }
}
