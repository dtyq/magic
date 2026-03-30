<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;
use Throwable;

readonly class SandboxVersionDomainService
{
    private const CACHE_KEY_LATEST_AGENT_IMAGE = 'super_magic:sandbox:latest_agent_image';

    private const CACHE_TTL_LATEST_AGENT_IMAGE = 30;

    private LoggerInterface $logger;

    public function __construct(
        private TopicDomainService $topicDomainService,
        private AgentDomainService $agentDomainService,
        private CacheInterface $cache,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('sandbox');
    }

    /**
     * 检查话题沙箱的镜像版本，返回当前版本和最新版本.
     *
     * @return array{current_version: string, latest_version: string, needs_update: bool}
     */
    public function checkSandboxVersion(int $topicId): array
    {
        $topicEntity = $this->topicDomainService->getTopicById($topicId);
        if (! $topicEntity) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND, 'topic.topic_not_found');
        }

        // 沙箱尚未创建（无 sandbox_id）时不需要升级
        if (empty($topicEntity->getSandboxId())) {
            return $this->buildSandboxVersionResult('', '');
        }

        return $this->buildSandboxVersionResult(
            $topicEntity->getAgentImage() ?? '',
            $this->getLatestAgentImageWithCache()
        );
    }

    /**
     * 批量检查话题沙箱镜像版本，返回每个 topic_id 是否需要升级.
     *
     * @param int[] $topicIds
     * @return array<int, bool> topicId => needUpgrade
     */
    public function checkNeedUpgradeByTopicIds(array $topicIds): array
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

        $latestImage = $this->getLatestAgentImageWithCache();
        $needUpgradeMap = [];
        foreach ($topics as $topic) {
            // 沙箱尚未创建（无 sandbox_id）时不需要升级
            if (empty($topic->getSandboxId())) {
                $needUpgradeMap[$topic->getId()] = false;
                continue;
            }
            $needUpgradeMap[$topic->getId()] = $this->buildSandboxVersionResult(
                $topic->getAgentImage() ?? '',
                $latestImage
            )['needs_update'];
        }

        return $needUpgradeMap;
    }

    /**
     * @return array{current_version: string, latest_version: string, needs_update: bool}
     */
    private function buildSandboxVersionResult(string $currentImage, string $latestImage): array
    {
        $currentVersion = self::extractImageVersion($currentImage);
        $latestVersion = self::extractImageVersion($latestImage);

        return [
            'current_version' => $currentVersion,
            'latest_version' => $latestVersion,
            // 网关有最新版本时：当前版本未知（agent_image 未入库）或版本不一致，均视为需要更新
            'needs_update' => ! empty($latestVersion) && $currentVersion !== $latestVersion,
        ];
    }

    /**
     * Fetch latest agent image with a short-lived cache to reduce gateway pressure.
     */
    private function getLatestAgentImageWithCache(): string
    {
        try {
            $cachedImage = $this->cache->get(self::CACHE_KEY_LATEST_AGENT_IMAGE);
            if (is_string($cachedImage)) {
                return $cachedImage;
            }
        } catch (Throwable $e) {
            $this->logger->warning('[Sandbox][Domain] Failed to read latest agent image cache', [
                'cache_key' => self::CACHE_KEY_LATEST_AGENT_IMAGE,
                'error' => $e->getMessage(),
            ]);
        }

        $latestImage = $this->agentDomainService->getLatestAgentImage();

        try {
            $this->cache->set(
                self::CACHE_KEY_LATEST_AGENT_IMAGE,
                $latestImage,
                self::CACHE_TTL_LATEST_AGENT_IMAGE
            );
        } catch (Throwable $e) {
            $this->logger->warning('[Sandbox][Domain] Failed to write latest agent image cache', [
                'cache_key' => self::CACHE_KEY_LATEST_AGENT_IMAGE,
                'error' => $e->getMessage(),
            ]);
        }

        return $latestImage;
    }

    /**
     * 从镜像字符串中提取版本号（冒号后面的部分）.
     * 例如：registry.example.com/agent:v1.2.3 → v1.2.3.
     */
    private static function extractImageVersion(string $image): string
    {
        if (empty($image)) {
            return '';
        }
        $pos = strrpos($image, ':');
        return $pos !== false ? substr($image, $pos + 1) : '';
    }
}
