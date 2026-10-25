<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\SuperAgent\Service;

use App\Domain\SuperMagic\Task\Service\AgentDomainService;
use App\Domain\SuperMagic\Task\Service\SandboxVersionDomainService;
use App\Domain\SuperMagic\Topic\Entity\TopicEntity;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use Hyperf\Logger\LoggerFactory;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use RuntimeException;

/** @internal */
class SandboxVersionDomainServiceTest extends TestCase
{
    #[DataProvider('imageCases')]
    public function testComparesRecordedImagesAndFallsBackToLegacyAgentImage(
        ?array $currentImages,
        ?string $legacyAgentImage,
        array $latestImages,
        ?bool $expected
    ): void {
        $topic = (new TopicEntity())
            ->setId(101)
            ->setSandboxId('sandbox-101')
            ->setAgentImage($legacyAgentImage)
            ->setSandboxImages($currentImages);

        $result = $this->service([$topic], $latestImages)->checkSandboxVersion(101);

        self::assertSame($expected, $result['needs_update']);
    }

    public static function imageCases(): array
    {
        $latest = [
            'agent_image' => 'registry/agent:5.0.92@sha256:new',
            'agfs_image' => 'registry/agfs:1.0.14@sha256:new',
        ];

        return [
            'complete images are current' => [$latest, 'legacy:ignored', $latest, false],
            'complete agent image changed' => [
                array_replace($latest, ['agent_image' => 'registry/agent:5.0.77@sha256:old']),
                'legacy:ignored',
                $latest,
                true,
            ],
            'complete agfs image changed' => [
                array_replace($latest, ['agfs_image' => 'registry/agfs:1.0.13@sha256:old']),
                'legacy:ignored',
                $latest,
                true,
            ],
            'same tag with different digest changed' => [
                array_replace($latest, ['agent_image' => 'registry/agent:5.0.92@sha256:old']),
                'legacy:ignored',
                $latest,
                true,
            ],
            'historical row with older legacy agent' => [
                null,
                'registry/agent:5.0.77@sha256:old',
                $latest,
                true,
            ],
            'historical row with current legacy agent but unknown agfs' => [
                null,
                $latest['agent_image'],
                $latest,
                null,
            ],
            'historical row without version evidence' => [null, null, $latest, null],
            'incomplete recorded images with older agent' => [
                ['agent_image' => 'registry/agent:5.0.77@sha256:old'],
                null,
                $latest,
                true,
            ],
            'latest images are incomplete' => [$latest, $latest['agent_image'], [], null],
        ];
    }

    public function testHistoricalRowUsesLegacyAgentVersionForDisplay(): void
    {
        $latest = [
            'agent_image' => 'registry/agent:5.0.92@sha256:new',
            'agfs_image' => 'registry/agfs:1.0.14',
        ];
        $topic = (new TopicEntity())
            ->setId(101)
            ->setSandboxId('sandbox-101')
            ->setAgentImage('registry/agent:5.0.77@sha256:old');

        $result = $this->service([$topic], $latest)->checkSandboxVersion(101);

        self::assertSame('5.0.77', $result['current_version']);
        self::assertSame('5.0.92', $result['latest_version']);
    }

    public function testGatewayFailureIsUnknown(): void
    {
        $topic = (new TopicEntity())
            ->setId(101)
            ->setSandboxId('sandbox-101')
            ->setAgentImage('registry/agent:5.0.77');

        self::assertNull(
            $this->service([$topic], new RuntimeException('unavailable'))
                ->checkSandboxVersion(101)['needs_update']
        );
    }

    public function testBatchFetchesLatestImagesOnceAndPreservesUnknown(): void
    {
        $latest = ['agent_image' => 'agent:v2', 'agfs_image' => 'agfs:v2'];
        $topics = [
            (new TopicEntity())
                ->setId(101)
                ->setSandboxId('s101')
                ->setSandboxImages($latest),
            (new TopicEntity())
                ->setId(102)
                ->setSandboxId('s102')
                ->setAgentImage('agent:v1'),
            (new TopicEntity())
                ->setId(103),
        ];

        self::assertSame(
            [101 => false, 102 => true, 103 => null],
            $this->service($topics, $latest)->checkNeedUpgradeByTopicIds([101, 102, 103, 101, 0])
        );
    }

    private function service(array $topics, array|RuntimeException $latest): SandboxVersionDomainService
    {
        $topicService = $this->createMock(TopicDomainService::class);
        $topicService->method('getTopicById')->willReturn($topics[0]);
        $topicService->method('getTopicsByIds')->willReturn($topics);

        $agentService = $this->createMock(AgentDomainService::class);
        $method = $agentService->expects(self::once())->method('getLatestImages');
        if ($latest instanceof RuntimeException) {
            $method->willThrowException($latest);
        } else {
            $method->willReturn($latest);
        }

        $loggerFactory = $this->createMock(LoggerFactory::class);
        $loggerFactory->method('get')->willReturn(new NullLogger());

        return new SandboxVersionDomainService($topicService, $agentService, $loggerFactory);
    }
}
