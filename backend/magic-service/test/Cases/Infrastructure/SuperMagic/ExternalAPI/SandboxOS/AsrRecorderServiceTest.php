<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\SuperMagic\ExternalAPI\SandboxOS;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\AsrRecorderService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrAudioConfig;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Constants\SandboxEndpoints;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\GatewayResult;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/**
 * @internal
 */
class AsrRecorderServiceTest extends TestCase
{
    public function testFinishTaskSendsForceResetWhenEnabled(): void
    {
        $captured = null;
        $service = $this->createService($captured);

        $service->finishTask(
            $this->createMock(DataIsolation::class),
            'sandbox-1',
            'session-test',
            '.workspace',
            $this->createAudioConfig(),
            null,
            null,
            null,
            true
        );

        self::assertIsArray($captured);
        self::assertArrayHasKey('force_reset', $captured);
        self::assertTrue($captured['force_reset']);
    }

    public function testFinishTaskOmitsForceResetByDefault(): void
    {
        $captured = null;
        $service = $this->createService($captured);

        $service->finishTask(
            $this->createMock(DataIsolation::class),
            'sandbox-1',
            'session-test',
            '.workspace',
            $this->createAudioConfig()
        );

        self::assertIsArray($captured);
        self::assertArrayNotHasKey('force_reset', $captured);
    }

    private function createService(?array &$captured): AsrRecorderService
    {
        $logger = $this->createMock(LoggerInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($logger);

        $gateway = $this->createMock(SandboxGatewayInterface::class);
        $gateway->method('proxySandboxRequest')
            ->willReturnCallback(function (
                DataIsolation $dataIsolation,
                string $sandboxId,
                string $method,
                string $path,
                array $data = [],
                array $headers = []
            ) use (&$captured): GatewayResult {
                $captured = $data;
                self::assertSame(SandboxEndpoints::ASR_TASK_FINISH, $path);

                return GatewayResult::success(['status' => 'running']);
            });

        return new AsrRecorderService($loggerFactory, $gateway);
    }

    private function createAudioConfig(): AsrAudioConfig
    {
        return new AsrAudioConfig(
            sourceDir: '.asr_recordings/session-test',
            targetDir: '录音总结_20260101_000000',
            outputFilename: '测试录音',
            fileShardCount: 3
        );
    }
}
