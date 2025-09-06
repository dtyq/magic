<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Middleware;

use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerInterface;
use Psr\Http\Message\MessageInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Log\LoggerInterface;
use Throwable;

use function Swow\defer;

class ResponseMiddleware implements MiddlewareInterface
{
    protected LoggerInterface $logger;

    private array $desensitizeHeaders = [
        'token',
        'authorization',
        'magic-authorization',
        'api-key',
    ];

    // 指定的 uri 不打印请求和响应详情
    private array $desensitizeUris = [
        '/conversation/chatCompletions',
        '/message',
        '/file',
        '/intelligence-rename',
    ];

    private array $ignoreUris = [
        '/heartbeat',
        '/favicon.ico',
    ];

    public function __construct(
        protected ContainerInterface $container,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('request-track');
    }

    /**
     * @throws Throwable
     */
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $path = $request->getUri()->getPath();
        if (! in_array($path, $this->ignoreUris, true)) {
            // 提前记录请求日志、请求 url、请求头
            $this->logger->info('请求跟踪开始', [
                'url' => $request->getRequestTarget(),
                'method' => $request->getMethod(),
                'headers' => $this->desensitizeRequestHeaders($request->getHeaders()),
                'remote_addr' => $request->getServerParams()['remote_addr'] ?? '',
            ]);
        }

        $startTime = microtime(true);
        try {
            $response = $handler->handle($request);
            return $response;
        } catch (Throwable $throwable) {
            $response = $throwable;
            throw $throwable;
        } finally {
            $endTime = microtime(true);
            // 避免阻塞响应
            defer(function () use ($request, $response, $startTime, $endTime) {
                $path = $request->getUri()->getPath();
                if (in_array($path, $this->ignoreUris, true)) {
                    return;
                }
                // 临时加一下敏感过滤
                if (! str_contains($path, 'aes')) {
                    $this->logger->info('请求跟踪信息', $this->formatMessage($request, $response, $startTime, $endTime));
                }
            });
        }
    }

    protected function formatMessage(ServerRequestInterface $request, MessageInterface|Throwable $response, float $startTime, float $endTime): array
    {
        if ($response instanceof MessageInterface) {
            $response = $response->getBody()->getContents();
        }
        if ($response instanceof Throwable) {
            $errorMsg = [
                'code' => $response->getCode(),
                'message' => $response->getMessage(),
            ];
            $errorResponse = Json::encode($errorMsg);
            $errorMsg['file'] = $response->getFile();
            $errorMsg['line'] = $response->getLine();
            $errorMsg['trace'] = $response->getTraceAsString();
            $this->logger->error('ResponseMiddleware', $errorMsg);
        }
        $headers = $this->desensitizeRequestHeaders($request->getHeaders());
        $uri = $request->getUri()->getPath();
        $parsedBody = $request->getParsedBody();
        $queryParams = $request->getQueryParams();
        foreach ($this->desensitizeUris as $desensitizeUri) {
            if (str_contains($uri, $desensitizeUri)) {
                $parsedBody = 'Desensitize';
                $queryParams = 'Desensitize';
                break;
            }
        }
        $requestBody = [
            'query_params' => $queryParams,
            'parsed_body' => $parsedBody,
        ];
        $responseBody = $errorResponse ?? $response;
        // 大于 5K 的数据不记录
        if (strlen($responseBody) > 5 * 1024) {
            $responseBody = 'ResponseBodyIsTooLarge';
        }
        if (strlen(serialize($requestBody)) > 5 * 1024) {
            $requestBody = 'RequestBodyIsTooLarge';
        }

        return [
            'url' => $request->getRequestTarget(),
            'method' => $request->getMethod(),
            'headers' => $headers,
            'remote_addr' => $request->getServerParams()['remote_addr'] ?? '',
            'startTime' => format_micro_time($startTime),
            'endTime' => format_micro_time($endTime),
            'cosTime' => round($endTime - $startTime),
            'cosMilliTime' => round($endTime - $startTime, 4) * 1000,
            'requestBody' => $requestBody,
            'responseBody' => $responseBody,
        ];
    }

    private function desensitizeRequestHeaders(array $headers): array
    {
        $list = [];
        foreach ($headers as $key => $value) {
            if (in_array(strtolower($key), $this->desensitizeHeaders)) {
                $value = ['******'];
            }
            $list[$key] = $value;
        }
        return $list;
    }
}
