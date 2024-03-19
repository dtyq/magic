<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SdkBase\Kernel\Component\Client;

use Dtyq\SdkBase\Kernel\Constant\RequestMethod;
use Dtyq\SdkBase\SdkBase;
use GuzzleHttp\ClientInterface as GuzzleHttpClientInterface;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use Throwable;

class ClientRequest implements ClientInterface
{
    public function __construct(
        private readonly SdkBase $sdkBase,
        private readonly array $headers = [],
    ) {
    }

    /**
     * 仅适合使用了 GuzzleHttp 的客户端.
     */
    public function request(RequestMethod $method, string $uri = '', array $options = []): ResponseInterface
    {
        $client = $this->sdkBase->getClient();
        if (! interface_exists(GuzzleHttpClientInterface::class) || ! ($client instanceof GuzzleHttpClientInterface)) {
            $this->sdkBase->getExceptionBuilder()->throw(500, 'Client must be an instance of ' . GuzzleHttpClientInterface::class);
        }

        $start = microtime(true);
        $content = '';

        // Set default timeout from config if not specified
        if (! isset($options['timeout'])) {
            $options['timeout'] = $this->sdkBase->getConfig()->getRequestTimeout();
        }

        try {
            $response = $client->request($method->value, $uri, $options);
            $content = $response->getBody()->getContents();
            if ($response->getStatusCode() != 200) {
                $this->sdkBase->getExceptionBuilder()->throw($response->getStatusCode(), $content);
            }
            $response->getBody()->rewind();
            return $response;
        } catch (Throwable $throwable) {
            throw $this->sdkBase->getExceptionBuilder()->createException((int) $throwable->getCode(), $throwable->getMessage());
        } finally {
            if (isset($throwable)) {
                $content = json_encode([
                    'code' => $throwable->getCode(),
                    'message' => '[bad_request]' . $throwable->getMessage(),
                    'file' => $throwable->getFile(),
                    'line' => $throwable->getLine(),
                ], JSON_UNESCAPED_UNICODE);
            }
            $this->log($method->value, $uri, $options, $content, $start);
        }
    }

    /**
     * 标准请求
     */
    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        $start = microtime(true);
        $content = '';
        try {
            foreach ($this->headers as $name => $value) {
                $request = $request->withHeader($name, $value);
            }
            $request->getBody()->rewind();
            $response = $this->sdkBase->getClient()->sendRequest($request);
            $content = $response->getBody()->getContents();
            if ($response->getStatusCode() != 200) {
                $this->sdkBase->getExceptionBuilder()->throw($response->getStatusCode(), $content);
            }
            $response->getBody()->rewind();
            return $response;
        } catch (Throwable $throwable) {
            throw $this->sdkBase->getExceptionBuilder()->createException((int) $throwable->getCode(), $throwable->getMessage());
        } finally {
            if (isset($throwable)) {
                $content = json_encode([
                    'code' => $throwable->getCode(),
                    'message' => '[bad_request]' . $throwable->getMessage(),
                    'file' => $throwable->getFile(),
                    'line' => $throwable->getLine(),
                ], JSON_UNESCAPED_UNICODE);
            }
            $request->getBody()->rewind();
            $this->log(
                $request->getMethod(),
                (string) $request->getUri(),
                [
                    'protocol_version' => $request->getProtocolVersion(),
                    'request_target' => $request->getRequestTarget(),
                    'body' => $request->getBody()->getContents(),
                    'header' => $request->getHeaders(),
                ],
                $content,
                $start
            );
            $request->getBody()->rewind();
        }
    }

    private function log(string $method, string $uri, array $options, string $content, ?float $startTime = null): void
    {
        $elapsedTime = round((microtime(true) - $startTime) * 1000, 2);
        $this->sdkBase->getLogger()->info(
            'client_request',
            [
                'method' => $method,
                'uri' => $uri,
                'options' => $options,
                'content' => $content,
                'elapsed_time' => $elapsedTime,
            ]
        );
    }
}
