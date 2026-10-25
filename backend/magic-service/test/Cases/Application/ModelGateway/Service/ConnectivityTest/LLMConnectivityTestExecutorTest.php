<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\ModelGateway\Service\ConnectivityTest;

use App\Application\ModelGateway\Service\ConnectivityTest\LLMConnectivityTestExecutor;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * @internal
 */
class LLMConnectivityTestExecutorTest extends TestCase
{
    public function testTextFailureSkipsMultimodalTest(): void
    {
        $multimodalCalls = 0;

        $response = LLMConnectivityTestExecutor::execute(
            static function (): void {
                throw new RuntimeException('text failed');
            },
            true,
            static function () use (&$multimodalCalls): void {
                ++$multimodalCalls;
            }
        );

        $this->assertFalse($response->isStatus());
        $this->assertSame('text failed', $response->getMessage());
        $this->assertSame(0, $multimodalCalls);
    }

    public function testTextSuccessWithoutMultimodalSupportStopsAfterFirstCall(): void
    {
        $textCalls = 0;
        $multimodalCalls = 0;

        $response = LLMConnectivityTestExecutor::execute(
            static function () use (&$textCalls): void {
                ++$textCalls;
            },
            false,
            static function () use (&$multimodalCalls): void {
                ++$multimodalCalls;
            }
        );

        $this->assertTrue($response->isStatus());
        $this->assertSame(1, $textCalls);
        $this->assertSame(0, $multimodalCalls);
    }

    public function testMultimodalFailureIncludesStageAndOriginalReason(): void
    {
        $response = LLMConnectivityTestExecutor::execute(
            static function (): void {
            },
            true,
            static function (): void {
                throw new RuntimeException('image input rejected');
            }
        );

        $this->assertFalse($response->isStatus());
        $this->assertStringContainsString('image input rejected', (string) $response->getMessage());
        $this->assertStringContainsString('multimodal', strtolower((string) $response->getMessage()));
    }

    public function testEmptyMultimodalFailureReasonFallsBackToGenericMessage(): void
    {
        $response = LLMConnectivityTestExecutor::execute(
            static function (): void {
            },
            true,
            static function (): void {
                throw new RuntimeException('');
            }
        );

        $this->assertFalse($response->isStatus());
        $this->assertStringContainsString('Request failed', (string) $response->getMessage());
    }

    public function testBothCallsSucceed(): void
    {
        $calls = [];

        $response = LLMConnectivityTestExecutor::execute(
            static function () use (&$calls): void {
                $calls[] = 'text';
            },
            true,
            static function () use (&$calls): void {
                $calls[] = 'multimodal';
            }
        );

        $this->assertTrue($response->isStatus());
        $this->assertSame(['text', 'multimodal'], $calls);
    }
}
