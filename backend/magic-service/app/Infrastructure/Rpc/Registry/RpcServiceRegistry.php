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
use App\Infrastructure\Rpc\Method\SvcMethods;
use App\Interfaces\KnowledgeBase\Rpc\Service\KnowledgeBasePermissionRpcService;
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
            $this->logger->warning('goEngineException No RPC services found by annotation');
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
                $this->logger->warning('goEngineException RPC service class not found', ['class' => $class]);
                continue;
            }

            $serviceName = trim($serviceAnnotation->getName());
            if ($serviceName === '') {
                $this->logger->warning('goEngineException RPC service name empty', ['class' => $class]);
                continue;
            }

            $handler = $container->get($class);

            foreach ($methodsByClass[$class] ?? [] as [$method, $methodAnnotation]) {
                $methodName = trim($methodAnnotation->getName());
                if ($methodName === '') {
                    $this->logger->warning('goEngineException RPC method name empty', ['class' => $class, 'method' => $method]);
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

        $this->registerKnowledgeBasePermissionHandlers($client, $container);
    }

    /**
     * @throws ContainerExceptionInterface
     * @throws NotFoundExceptionInterface
     */
    private function registerKnowledgeBasePermissionHandlers(JsonRpcRuntimeClient $client, ContainerInterface $container): void
    {
        $handler = $container->get(KnowledgeBasePermissionRpcService::class);
        $serviceName = SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE_PERMISSION;
        $methods = [
            SvcMethods::METHOD_LIST_OPERATIONS => 'listOperations',
            SvcMethods::METHOD_INITIALIZE => 'initialize',
            SvcMethods::METHOD_GRANT_OWNER => 'grantOwner',
            SvcMethods::METHOD_CLEANUP => 'cleanup',
            SvcMethods::METHOD_CHECK_OFFICIAL_ORGANIZATION_MEMBER => 'checkOfficialOrganizationMember',
            SvcMethods::METHOD_CHECK_OFFICIAL_ORGANIZATION_ADMIN => 'checkOfficialOrganizationAdmin',
        ];

        foreach ($methods as $rpcMethodName => $handlerMethod) {
            $rpcMethod = $serviceName . '.' . $rpcMethodName;
            $client->registerHandler($rpcMethod, static function (mixed $params) use ($handler, $handlerMethod) {
                return $handler->{$handlerMethod}($params ?? []);
            });

            $this->logger->debug('RPC handler registered by fallback', [
                'method' => $rpcMethod,
                'class' => KnowledgeBasePermissionRpcService::class,
                'handler' => $handlerMethod,
            ]);
        }
    }
}
