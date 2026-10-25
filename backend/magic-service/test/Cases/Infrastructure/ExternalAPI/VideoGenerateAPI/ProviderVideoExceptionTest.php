<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;

/** @internal */
final class ProviderVideoExceptionTest extends TestCase
{
    public function testProvidesUnderlyingRequestResponseDetails(): void
    {
        $requestException = new RequestException(
            'provider request failed',
            new Request('POST', 'https://gemini.example/v1/interactions'),
            new Response(400, [], 'Video response format duration must be positive'),
        );
        $exception = new ProviderVideoException(VideoGenerateErrorCode::INVALID_PARAMETER, 'mapped error', $requestException);

        self::assertSame($requestException, $exception->getRequestException());
        self::assertSame(400, $exception->getHttpStatus());
        self::assertSame('Video response format duration must be positive', $exception->getResponseContent());
    }

    public function testReturnsNullWhenNoRequestResponseExists(): void
    {
        $exception = new ProviderVideoException(VideoGenerateErrorCode::INVALID_PARAMETER, 'mapped error');

        self::assertNull($exception->getRequestException());
        self::assertNull($exception->getResponseContent());
        self::assertNull($exception->getHttpStatus());
    }
}
