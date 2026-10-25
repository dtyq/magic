<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Http\Aspect;

use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Utils;
use Hyperf\Di\Aop\AbstractAspect;
use Hyperf\Di\Aop\ProceedingJoinPoint;
use Psr\Http\Message\RequestInterface;

/**
 * Normalizes request values deprecated by Guzzle 7.11 before transfer.
 *
 * Third-party SDKs still provide lowercase methods, string timeouts, and
 * integer header values which Guzzle 8 will reject.
 */
class GuzzleHeaderCompatibilityAspect extends AbstractAspect
{
    public array $classes = [
        Client::class . '::request',
        Client::class . '::requestAsync',
        Client::class . '::send',
        Client::class . '::sendAsync',
        Client::class . '::sendRequest',
    ];

    public function process(ProceedingJoinPoint $proceedingJoinPoint): mixed
    {
        $arguments = &$proceedingJoinPoint->arguments['keys'];

        if (isset($arguments['method'])) {
            $arguments['method'] = Utils::asciiToUpper($arguments['method']);
        }

        if (isset($arguments['request']) && $arguments['request'] instanceof RequestInterface) {
            $arguments['request'] = $arguments['request']->withMethod(
                Utils::asciiToUpper($arguments['request']->getMethod())
            );
        }

        if (isset($arguments['options']) && is_array($arguments['options'])) {
            $arguments['options'] = $this->normalizeOptions($arguments['options']);
        }

        return $proceedingJoinPoint->process();
    }

    private function normalizeOptions(array $options): array
    {
        foreach (['connect_timeout', 'read_timeout', 'timeout'] as $name) {
            if (isset($options[$name]) && is_string($options[$name]) && is_numeric($options[$name])) {
                $options[$name] = (float) $options[$name];
            }
        }

        if (isset($options['body']) && is_scalar($options['body']) && ! is_string($options['body'])) {
            $options['body'] = (string) $options['body'];
        }

        if (isset($options['headers']) && is_array($options['headers'])) {
            $options['headers'] = $this->normalizeHeaders($options['headers']);
        }

        return $options;
    }

    private function normalizeHeaders(array $headers): array
    {
        foreach ($headers as $name => $value) {
            if (is_array($value)) {
                if ($value === []) {
                    unset($headers[$name]);
                    continue;
                }

                $headers[$name] = array_map(
                    static fn (mixed $item): mixed => is_scalar($item) || $item === null
                        ? (string) $item
                        : $item,
                    $value
                );
                continue;
            }

            if (is_scalar($value) || $value === null) {
                $headers[$name] = (string) $value;
            }
        }

        return $headers;
    }
}
