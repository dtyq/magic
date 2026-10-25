<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Service;

use App\Domain\SuperMagic\Task\Entity\ValueObject\SandboxImageVersion;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\ErrorCode\SuperAgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

readonly class SandboxVersionDomainService
{
    private LoggerInterface $logger;

    public function __construct(
        private TopicDomainService $topicDomainService,
        private AgentDomainService $agentDomainService,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('sandbox');
    }

    /**
     * Check recorded images against the current release standard.
     * $useCache is retained for call compatibility; standards are fetched per request.
     *
     * @return array{current_version: string, latest_version: string, needs_update: null|bool}
     */
    public function checkSandboxVersion(int $topicId, bool $useCache = true, string $effectiveSandboxId = ''): array
    {
        $topicEntity = $this->topicDomainService->getTopicById($topicId);
        if (! $topicEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        // 持久化映射为空时，仅接受与 topic_id 完全一致的 legacy 沙箱身份。
        if ($topicEntity->getSandboxId() === '' && $effectiveSandboxId !== (string) $topicId) {
            return $this->buildSandboxVersionResult(null, null, []);
        }

        return $this->buildSandboxVersionResult(
            $topicEntity->getSandboxImages(),
            $topicEntity->getAgentImage(),
            $this->getLatestImages()
        );
    }

    /**
     * Compare a batch against one release standard without caching.
     *
     * @param int[] $topicIds
     * @return array<int, null|bool> topicId => needUpgrade
     */
    public function checkNeedUpgradeByTopicIds(array $topicIds, bool $useCache = true): array
    {
        $topicIds = array_values(array_unique(array_filter(
            array_map('intval', $topicIds),
            static fn (int $topicId) => $topicId > 0
        )));
        if (empty($topicIds)) {
            return [];
        }

        $topics = $this->topicDomainService->getTopicsByIds($topicIds);
        if (empty($topics)) {
            return [];
        }

        $latestImages = $this->getLatestImages();
        $needUpgradeMap = [];
        foreach ($topics as $topic) {
            $hasSandbox = $topic->getSandboxId() !== '';
            $versionResult = $this->buildSandboxVersionResult(
                $hasSandbox ? $topic->getSandboxImages() : null,
                $hasSandbox ? $topic->getAgentImage() : null,
                $latestImages
            );
            $needUpgradeMap[$topic->getId()] = $versionResult['needs_update'];
        }

        return $needUpgradeMap;
    }

    /**
     * Historical rows may not have the AGFS image. A known Agent mismatch is
     * still sufficient to require an upgrade, while an Agent match remains
     * unknown because the historical AGFS version cannot be inferred.
     *
     * @param null|array<string, mixed> $currentImages
     * @param array<string, mixed> $latestImages
     * @return array{current_version: string, latest_version: string, needs_update: null|bool}
     */
    private function buildSandboxVersionResult(
        ?array $currentImages,
        ?string $legacyAgentImage,
        array $latestImages
    ): array {
        $needsUpdate = null;
        if (SandboxImageVersion::isComplete($latestImages)) {
            if (SandboxImageVersion::isComplete($currentImages)) {
                $needsUpdate = SandboxImageVersion::compare($currentImages, $latestImages);
            } else {
                $knownAgentImage = SandboxImageVersion::nonEmpty($currentImages[SandboxImageVersion::AGENT_IMAGE_KEY] ?? null)
                    ?? SandboxImageVersion::nonEmpty($legacyAgentImage);
                if ($knownAgentImage !== null && $knownAgentImage !== $latestImages[SandboxImageVersion::AGENT_IMAGE_KEY]) {
                    $needsUpdate = true;
                }
            }
        }

        $currentAgentImage = SandboxImageVersion::nonEmpty($currentImages[SandboxImageVersion::AGENT_IMAGE_KEY] ?? null)
            ?? SandboxImageVersion::nonEmpty($legacyAgentImage)
            ?? '';

        return [
            'current_version' => SandboxImageVersion::extractTag($currentAgentImage),
            'latest_version' => SandboxImageVersion::extractTag($latestImages[SandboxImageVersion::AGENT_IMAGE_KEY] ?? ''),
            'needs_update' => $needsUpdate,
        ];
    }

    /** @return array<string, mixed> */
    private function getLatestImages(): array
    {
        try {
            return $this->agentDomainService->getLatestImages();
        } catch (Throwable $e) {
            $this->logger->warning('[Sandbox][Version] Failed to fetch latest images', [
                'error' => $e->getMessage(),
            ]);
            return [];
        }
    }
}
