<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Util\Http;

use App\Infrastructure\Util\Http\Aspect\GuzzleHeaderCompatibilityAspect;
use ErrorException;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Promise\PromiseInterface;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use Hyperf\Di\Aop\ProceedingJoinPoint;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use ReflectionProperty;
use Tos\Model\Constant;
use Tos\Model\PutObjectInput;
use Tos\TosClient;

/**
 * @internal
 */
class GuzzleHeaderCompatibilityTest extends TestCase
{
    public function testArrayHeaderValuesAreConvertedToStringArray(): void
    {
        $captured = null;
        $joinPoint = new ProceedingJoinPoint(
            static function (array $options) use (&$captured): null {
                $captured = $options;
                return null;
            },
            Client::class,
            'requestAsync',
            [
                'keys' => [
                    'options' => [
                        'headers' => ['X-Values' => ['1', 2, null]],
                    ],
                ],
                'order' => ['options'],
            ],
        );
        $joinPoint->pipe = static fn (ProceedingJoinPoint $point) => $point->processOriginalMethod();

        (new GuzzleHeaderCompatibilityAspect())->process($joinPoint);

        self::assertSame(['1', '2', ''], $captured['headers']['X-Values']);
    }

    public function testDeprecatedRequestOptionsAndMethodAreNormalized(): void
    {
        $captured = null;
        $joinPoint = new ProceedingJoinPoint(
            static function (string $method, array $options) use (&$captured): null {
                $captured = compact('method', 'options');
                return null;
            },
            Client::class,
            'request',
            [
                'keys' => [
                    'method' => 'post',
                    'options' => [
                        'body' => 123,
                        'connect_timeout' => '2',
                        'headers' => [
                            'X-Empty' => [],
                            'X-Values' => [1, null],
                        ],
                        'read_timeout' => '3',
                        'timeout' => '1.5',
                    ],
                ],
                'order' => ['method', 'options'],
            ],
        );
        $joinPoint->pipe = static fn (ProceedingJoinPoint $point) => $point->processOriginalMethod();

        (new GuzzleHeaderCompatibilityAspect())->process($joinPoint);

        self::assertSame('POST', $captured['method']);
        self::assertSame('123', $captured['options']['body']);
        self::assertSame(2.0, $captured['options']['connect_timeout']);
        self::assertSame(3.0, $captured['options']['read_timeout']);
        self::assertSame(1.5, $captured['options']['timeout']);
        self::assertArrayNotHasKey('X-Empty', $captured['options']['headers']);
        self::assertSame(['1', ''], $captured['options']['headers']['X-Values']);
    }

    public function testLowercaseRequestObjectMethodIsUppercased(): void
    {
        $captured = null;
        $joinPoint = new ProceedingJoinPoint(
            static function (Request $request) use (&$captured): null {
                $captured = $request;
                return null;
            },
            Client::class,
            'sendRequest',
            [
                'keys' => [
                    'request' => new Request('post', 'https://example.com'),
                ],
                'order' => ['request'],
            ],
        );
        $joinPoint->pipe = static fn (ProceedingJoinPoint $point) => $point->processOriginalMethod();

        (new GuzzleHeaderCompatibilityAspect())->process($joinPoint);

        self::assertSame('POST', $captured->getMethod());
    }

    #[DataProvider('contentLengthProvider')]
    public function testPutObjectNormalizesIntegerContentLengthBeforePsr7(int $contentLength): void
    {
        $history = [];
        $handler = HandlerStack::create(new MockHandler([
            new Response(200, [
                Constant::HeaderRequestId => 'test-request-id',
                Constant::HeaderETag => 'test-etag',
            ]),
        ]));
        $handler->push(Middleware::history($history));

        $httpClient = new class(new GuzzleHeaderCompatibilityAspect(), ['handler' => $handler]) extends Client {
            public function __construct(private GuzzleHeaderCompatibilityAspect $aspect, array $config = [])
            {
                parent::__construct($config);
            }

            public function requestAsync(string $method, $uri = '', array $options = []): PromiseInterface
            {
                $joinPoint = new ProceedingJoinPoint(
                    function (string $method, $uri = '', array $options = []): PromiseInterface {
                        return parent::requestAsync($method, $uri, $options);
                    },
                    Client::class,
                    'requestAsync',
                    [
                        'keys' => compact('method', 'uri', 'options'),
                        'order' => ['method', 'uri', 'options'],
                    ],
                );
                $joinPoint->pipe = static fn (ProceedingJoinPoint $point) => $point->processOriginalMethod();

                return $this->aspect->process($joinPoint);
            }
        };

        $client = new TosClient([
            'region' => 'cn-beijing',
            'ak' => 'test-ak',
            'sk' => 'test-sk',
            'endpoint' => 'https://tos.example.com',
        ]);
        (new ReflectionProperty($client, 'client'))->setValue($client, $httpClient);

        set_error_handler(static function (int $severity, string $message): bool {
            if ($severity === E_USER_DEPRECATED && str_contains($message, 'Passing int')) {
                throw new ErrorException($message, 0, $severity);
            }

            return false;
        });

        try {
            $input = new PutObjectInput('test-bucket', 'test-key');
            $input->setContent(str_repeat('x', $contentLength));
            $input->setContentLength($contentLength);
            $client->putObject($input);
        } finally {
            restore_error_handler();
        }

        self::assertCount(1, $history);
        self::assertSame([(string) $contentLength], $history[0]['request']->getHeader(Constant::HeaderContentLength));
    }

    public static function contentLengthProvider(): array
    {
        return [
            'empty object' => [0],
            'non-empty object' => [1],
        ];
    }
}
