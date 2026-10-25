<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Asr\Service;

use App\Application\Speech\DTO\AsrTaskStatusDTO;
use App\Domain\Asr\Repository\AsrTaskRepository;
use App\Domain\Asr\Service\AsrTaskDomainService;
use App\Domain\SuperMagic\File\Entity\AudioProjectEntity;
use App\Domain\SuperMagic\File\Repository\Facade\AudioProjectRepositoryInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

/**
 * @internal
 */
class AsrTaskDomainServiceTest extends TestCase
{
    public function testSetAudioFormatKeepsRedisStateWhenAudioProjectDoesNotExist(): void
    {
        $audioProjectRepository = $this->createMock(AudioProjectRepositoryInterface::class);
        $audioProjectRepository->expects($this->once())
            ->method('findByProjectId')
            ->with(1001)
            ->willReturn(null);
        $audioProjectRepository->expects($this->never())->method('setAudioFormatIfUnset');

        $taskStatus = $this->createTaskStatus();
        $service = $this->createService($this->createTaskRepository(), $audioProjectRepository);

        $service->setAudioFormat($taskStatus, '.OPUS');

        self::assertSame('opus', $taskStatus->audioFormat);
    }

    public function testSetAudioFormatKeepsRedisStateWhenProjectIdIsEmpty(): void
    {
        $audioProjectRepository = $this->createMock(AudioProjectRepositoryInterface::class);
        $audioProjectRepository->expects($this->never())->method('findByProjectId');
        $audioProjectRepository->expects($this->never())->method('setAudioFormatIfUnset');

        $taskStatus = $this->createTaskStatus(['project_id' => null]);
        $service = $this->createService($this->createTaskRepository(), $audioProjectRepository);

        $service->setAudioFormat($taskStatus, 'wav');

        self::assertSame('wav', $taskStatus->audioFormat);
    }

    public function testSetAudioFormatPersistsWhenAudioProjectExists(): void
    {
        $audioProject = (new AudioProjectEntity())->setProjectId(1001);
        $audioProjectRepository = $this->createMock(AudioProjectRepositoryInterface::class);
        $audioProjectRepository->expects($this->once())
            ->method('findByProjectId')
            ->with(1001)
            ->willReturn($audioProject);
        $audioProjectRepository->expects($this->once())
            ->method('setAudioFormatIfUnset')
            ->with(1001, 'opus');

        $taskStatus = $this->createTaskStatus();
        $service = $this->createService($this->createTaskRepository(), $audioProjectRepository);

        $service->setAudioFormat($taskStatus, 'opus');

        self::assertSame('opus', $taskStatus->audioFormat);
    }

    public function testSetAudioFormatIsIdempotentForSamePersistedFormat(): void
    {
        $audioProject = (new AudioProjectEntity())->setProjectId(1001)->setAudioFormat('opus');
        $audioProjectRepository = $this->createMock(AudioProjectRepositoryInterface::class);
        $audioProjectRepository->method('findByProjectId')->willReturn($audioProject);
        $audioProjectRepository->expects($this->once())
            ->method('setAudioFormatIfUnset')
            ->with(1001, 'opus');

        $taskStatus = $this->createTaskStatus();
        $service = $this->createService($this->createTaskRepository(), $audioProjectRepository);

        $service->setAudioFormat($taskStatus, 'opus');

        self::assertSame('opus', $taskStatus->audioFormat);
    }

    public function testSetAudioFormatRejectsTaskFormatConflict(): void
    {
        $taskStatus = $this->createTaskStatus(['audio_format' => 'wav']);
        $audioProjectRepository = $this->createMock(AudioProjectRepositoryInterface::class);
        $service = $this->createService($this->createTaskRepository(false), $audioProjectRepository);

        $this->expectException(InvalidArgumentException::class);
        $service->setAudioFormat($taskStatus, 'opus');
    }

    public function testSetAudioFormatRejectsPersistedFormatConflict(): void
    {
        $audioProject = (new AudioProjectEntity())->setProjectId(1001)->setAudioFormat('wav');
        $audioProjectRepository = $this->createMock(AudioProjectRepositoryInterface::class);
        $audioProjectRepository->method('findByProjectId')->willReturn($audioProject);
        $audioProjectRepository->expects($this->never())->method('setAudioFormatIfUnset');

        $taskStatus = $this->createTaskStatus();
        $service = $this->createService($this->createTaskRepository(false), $audioProjectRepository);

        $this->expectException(InvalidArgumentException::class);
        $service->setAudioFormat($taskStatus, 'opus');
    }

    /**
     * @param array<string, mixed> $overrides
     */
    private function createTaskStatus(array $overrides = []): AsrTaskStatusDTO
    {
        return new AsrTaskStatusDTO(array_merge([
            'task_key' => 'task-1001',
            'user_id' => 'user-1001',
            'project_id' => '1001',
        ], $overrides));
    }

    private function createTaskRepository(bool $expectSave = true): AsrTaskRepository
    {
        $redis = $this->createMock(AsrTaskDomainServiceTestRedis::class);
        if ($expectSave) {
            $redis->expects($this->once())
                ->method('hMSet')
                ->with(
                    $this->anything(),
                    $this->callback(static fn (array $values): bool => ($values['audio_format'] ?? null) !== null)
                );
            $redis->expects($this->once())->method('expire');
        } else {
            $redis->expects($this->never())->method('hMSet');
            $redis->expects($this->never())->method('expire');
        }

        return new AsrTaskRepository($redis);
    }

    private function createService(
        AsrTaskRepository $taskRepository,
        AudioProjectRepositoryInterface $audioProjectRepository
    ): AsrTaskDomainService {
        $redis = $this->createMock(Redis::class);
        $logger = $this->createMock(LoggerInterface::class);
        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn($logger);

        return new AsrTaskDomainService(
            $taskRepository,
            $audioProjectRepository,
            $redis,
            $loggerFactory
        );
    }
}

class AsrTaskDomainServiceTestRedis extends Redis
{
    public function __construct()
    {
    }

    public function hMSet(string $key, array $values): bool
    {
        return true;
    }

    public function expire(string $key, int $ttl): bool
    {
        return true;
    }
}
