<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\ApiResponse\Aspect;

use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\ApiResponse\Exception\ApiResponseException;
use Dtyq\ApiResponse\ResponseFactory;
use Exception;
use Hyperf\Contract\ConfigInterface;
use Hyperf\Di\Annotation\Aspect;
use Hyperf\Di\Aop\AbstractAspect;
use Hyperf\Di\Aop\ProceedingJoinPoint;
use Psr\Http\Message\ResponseInterface;

#[Aspect(classes: [], annotations: [ApiResponse::class], priority: 99)]
class ApiResponseAspect extends AbstractAspect
{
    protected ConfigInterface $config;

    public function __construct(ConfigInterface $config)
    {
        $this->config = $config;
        if (is_array($this->config->get('api-response.version'))) {
            ResponseFactory::setConfig($this->config->get('api-response.version'));
        }
    }

    /**
     * @throws \Hyperf\Di\Exception\Exception
     * @throws ApiResponseException
     */
    public function process(ProceedingJoinPoint $proceedingJoinPoint)
    {
        $metadata = $proceedingJoinPoint->getAnnotationMetadata();
        /** @var ApiResponse $annotation */
        $annotation = $metadata->method[ApiResponse::class] ?? $metadata->class[ApiResponse::class] ?? null;
        if (! $annotation instanceof ApiResponse) {
            return $proceedingJoinPoint->process();
        }

        $reflectionMethod = $proceedingJoinPoint->getReflectMethod();
        if (! $reflectionMethod->isPublic()) {
            return $proceedingJoinPoint->process();
        }

        $version = $annotation->version ?: $this->config->get('api-response.default.version', 'standard');
        $needTransform = $annotation->needTransform;
        $responseResult = ResponseFactory::create($version);

        $catchExceptions = $this->config->get('api-response.error_exception');
        if (is_string($catchExceptions)) {
            $catchExceptions = [$catchExceptions];
        }
        try {
            $result = $proceedingJoinPoint->process();
            if ($needTransform === false) {
                return $result;
            }

            if (! $result instanceof ResponseInterface) {
                $result = $responseResult->success($result)->body();
            }
        } catch (Exception $e) {
            $code = $e->getCode();
            $message = $e->getMessage();
            $catchException = false;
            foreach ($catchExceptions ?? [] as $exception => $handler) {
                if (is_string($handler) && is_integer($exception)) {
                    $exception = $handler;
                }
                if ($e instanceof $exception) {
                    $catchException = true;
                    if (is_callable($handler)) {
                        $handlerResult = $handler($e);
                        $code = $handlerResult['code'] ?? $code;
                        $message = $handlerResult['message'] ?? $message;
                    }
                    break;
                }
            }
            if ($needTransform === false || ! $catchException) {
                throw $e;
            }

            $result = $responseResult->error($code, $message)->body();
        }

        return $result;
    }
}
