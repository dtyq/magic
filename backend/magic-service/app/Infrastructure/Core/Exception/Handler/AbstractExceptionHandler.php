<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Exception\Handler;

use Hyperf\ExceptionHandler\ExceptionHandler;
use Hyperf\HttpMessage\Stream\SwooleStream;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Log\LoggerInterface;
use Throwable;

abstract class AbstractExceptionHandler extends ExceptionHandler
{
    protected LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly ContainerInterface $container,
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    public function handle(Throwable $throwable, ResponseInterface $response): ResponseInterface
    {
        $this->stopPropagation();
        $request = $this->container->get(RequestInterface::class);
        $errInfo = [
            'request_info' => [
                'path' => $request->getUri()->getPath(),
            ],
            'error_info' => [
                'code' => $throwable->getCode(),
                'message' => $throwable->getMessage(),
                'line' => $throwable->getLine(),
                'file' => $throwable->getFile(),
                'exception_type' => get_class($throwable),
            ],
        ];
        $this->logger->error($throwable->getMessage(), $errInfo);
        $this->logger->info('错误跟踪信息', [
            'trace_as_string' => $throwable->getTrace(),
        ]);
        return $response->withHeader('Server', 'Hyperf')->withStatus(500)->withBody(new SwooleStream('Internal Server Error.'));
    }
}
