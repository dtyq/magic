<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Speech\Service;

use App\Application\Speech\DTO\AsrTaskStatusDTO;
use App\Application\Speech\Enum\AsrTaskStatusEnum;
use App\Application\Speech\Service\AsrSandboxResponseHandler;
use App\Application\Speech\Service\AsrSandboxService;
use App\Domain\Asr\Repository\AsrTaskRepository;
use App\Domain\Asr\Service\AsrTaskDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\SuperMagic\File\Repository\Facade\AudioProjectRepositoryInterface;
use App\Domain\SuperMagic\File\Service\TaskFileDomainService;
use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\AsrRecorderInterface;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrAudioConfig;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrMarkerFileConfig;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrNoteFileConfig;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrTranscriptFileConfig;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Response\AsrRecorderResponse;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/**
 * @internal
 */
class AsrSandboxServiceRecoverTest extends TestCase
{
    /**
     * 沙箱任务已 error 时，recover 必须带上 forceReset=true 重新提交 finish，
     * 这样沙箱侧才会忽略并清零已耗尽的重试计数。
     */
    public function testRecoverFinishRecordingForwardsForceReset(): void
    {
        $recorder = $this->createMock(AsrRecorderInterface::class);

        // queryTask 返回 error 状态（非传输层失败），触发 recover 的重新提交分支
        $recorder->method('queryTask')->willReturn(
            new AsrRecorderResponse(2000, 'error', ['status' => 'error', 'error_message' => 'retry_limit_reached(10/10)'])
        );

        $capturedForceReset = null;
        $recorder->expects($this->once())
            ->method('finishTask')
            ->willReturnCallback(function (
                DataIsolation $dataIsolation,
                string $sandboxId,
                string $taskKey,
                string $workspaceDir,
                AsrAudioConfig $audioConfig,
                ?AsrNoteFileConfig $noteFileConfig = null,
                ?AsrTranscriptFileConfig $transcriptFileConfig = null,
                ?AsrMarkerFileConfig $markerFileConfig = null,
                bool $forceReset = false
            ) use (&$capturedForceReset): AsrRecorderResponse {
                $capturedForceReset = $forceReset;

                return new AsrRecorderResponse(1000, 'ok', [
                    'status' => 'completed',
                    'file_path' => '录音总结/测试录音.m4a',
                    'duration' => 10,
                    'file_size' => 1024,
                ]);
            });

        $service = $this->createService($recorder);

        $taskStatus = new AsrTaskStatusDTO([
            'task_key' => 'session-force',
            'sandbox_id' => 'sandbox-1',
            'temp_hidden_directory' => '.asr_recordings/session-force',
            'display_directory' => '录音总结_20260101_000000',
            'file_shard_count' => 2,
        ]);

        $service->recoverFinishRecording(
            $this->createMock(DataIsolation::class),
            $taskStatus,
            '测试录音',
            AsrTaskStatusEnum::AUDIO_PROCESSED
        );

        self::assertTrue($capturedForceReset);
    }

    private function createService(AsrRecorderInterface $recorder): AsrSandboxService
    {
        $service = new AsrSandboxService(
            $recorder,
            $this->createMock(AsrSandboxResponseHandler::class),
            $this->createMock(TaskFileDomainService::class),
            $this->createMock(AgentDomainService::class),
            $this->createMock(TopicDomainService::class),
            $this->createMock(TaskDomainService::class),
            $this->createAsrTaskDomainService(),
        );

        // 无 Hyperf 容器时注入 logger，避免 HasLogger 懒加载访问 ApplicationContext
        $service->logger = $this->createMock(LoggerInterface::class);

        return $service;
    }

    /**
     * AsrTaskDomainService 是 readonly 类，无法被 PHPUnit 直接 mock，
     * 用最小的真实实例替代；recover 成功路径不会调用它。
     */
    private function createAsrTaskDomainService(): AsrTaskDomainService
    {
        $logger = $this->createMock(LoggerInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($logger);

        return new AsrTaskDomainService(
            new AsrTaskRepository($this->createMock(Redis::class)),
            $this->createMock(AudioProjectRepositoryInterface::class),
            $this->createMock(Redis::class),
            $loggerFactory
        );
    }
}
