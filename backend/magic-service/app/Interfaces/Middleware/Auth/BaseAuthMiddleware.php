<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Middleware\Auth;

use Hyperf\Context\ApplicationContext;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerExceptionInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

abstract class BaseAuthMiddleware implements MiddlewareInterface
{
    protected ?LoggerInterface $logger = null;

    /**
     * @throws Throwable
     */
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if ($this->logger === null) {
            try {
                $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)->get(static::class);
            } catch (ContainerExceptionInterface) {
            }
        }

        try {
            return $this->doProcess($request, $handler);
        } catch (Throwable $e) {
            $this->logError($request, $e);
            throw $e;
        }
    }

    /**
     * 子类实现具体的鉴权逻辑.
     */
    abstract protected function doProcess(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface;

    /**
     * 记录异常日志.
     */
    protected function logError(ServerRequestInterface $request, Throwable $e): void
    {
        $logData = [
            'uri' => (string) $request->getUri(),
            'headers' => $this->desensitizeHeaders($request->getHeaders()),
            'exception' => [
                'message' => $e->getMessage(),
                'code' => $e->getCode(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ],
        ];

        $this->logger?->error('AuthFlow error', $logData);
    }

    /**
     * 脱敏敏感头信息，避免日志泄漏。
     *
     * @param array<string, array<int, string>> $headers
     * @return array<string, array<int, string>>
     */
    private function desensitizeHeaders(array $headers): array
    {
        $sensitive = [
            'token',
            'authorization',
            'magic-authorization',
            'api-key',
            'user-authorization',
        ];

        $result = [];
        foreach ($headers as $key => $values) {
            if (in_array(strtolower($key), $sensitive, true)) {
                $result[$key] = ['******'];
            } else {
                $result[$key] = $values;
            }
        }
        return $result;
    }
}
