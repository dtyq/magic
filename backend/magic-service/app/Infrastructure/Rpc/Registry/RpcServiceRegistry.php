<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Rpc\Registry;

use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Rpc\Annotation\RpcMethod;
use App\Infrastructure\Rpc\Annotation\RpcService;
use App\Infrastructure\Rpc\JsonRpc\JsonRpcRuntimeClient;
use Hyperf\Di\Annotation\AnnotationCollector;
use Psr\Container\ContainerExceptionInterface;
use Psr\Container\ContainerInterface;
use Psr\Container\NotFoundExceptionInterface;

class RpcServiceRegistry
{
    use HasLogger;

    /**
     * @throws ContainerExceptionInterface
     * @throws NotFoundExceptionInterface
     */
    public function register(JsonRpcRuntimeClient $client, ContainerInterface $container): void
    {
        $services = AnnotationCollector::getClassesByAnnotation(RpcService::class);
        if (empty($services)) {
            $this->logger->warning('No RPC services found by annotation');
            return;
        }

        $methods = AnnotationCollector::getMethodsByAnnotation(RpcMethod::class);
        $methodsByClass = [];
        foreach ($methods as $item) {
            $class = $item['class'] ?? '';
            $method = $item['method'] ?? '';
            $annotation = $item['annotation'] ?? null;
            if (! $class || ! $method || ! $annotation instanceof RpcMethod) {
                continue;
            }
            if (! $annotation->isEnabled()) {
                continue;
            }
            $methodsByClass[$class][] = [$method, $annotation];
        }

        foreach ($services as $class => $serviceAnnotation) {
            if (! $serviceAnnotation instanceof RpcService || ! $serviceAnnotation->isEnabled()) {
                continue;
            }

            if (! class_exists($class)) {
                $this->logger->warning('RPC service class not found', ['class' => $class]);
                continue;
            }

            $serviceName = trim($serviceAnnotation->getName());
            if ($serviceName === '') {
                $this->logger->warning('RPC service name empty', ['class' => $class]);
                continue;
            }

            $handler = $container->get($class);

            foreach ($methodsByClass[$class] ?? [] as [$method, $methodAnnotation]) {
                $methodName = trim($methodAnnotation->getName());
                if ($methodName === '') {
                    $this->logger->warning('RPC method name empty', ['class' => $class, 'method' => $method]);
                    continue;
                }

                $rpcMethod = $methodAnnotation->isFull()
                    ? $methodName
                    : $serviceName . '.' . $methodName;

                $client->registerHandler($rpcMethod, function (mixed $params) use ($handler, $method) {
                    return $handler->{$method}($params ?? []);
                });

                $this->logger->debug('RPC handler registered', ['method' => $rpcMethod, 'class' => $class, 'handler' => $method]);
            }
        }
    }
}
