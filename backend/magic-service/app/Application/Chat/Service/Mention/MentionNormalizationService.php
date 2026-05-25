<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service\Mention;

use App\Application\Chat\Service\Mention\Normalizer\AgentMentionNormalizer;
use App\Application\Chat\Service\Mention\Normalizer\McpMentionNormalizer;
use App\Application\Chat\Service\Mention\Normalizer\PassthroughMentionNormalizer;
use App\Application\Chat\Service\Mention\Normalizer\ToolMentionNormalizer;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionType;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * Mention 规范化编排器。
 *
 * 把前端最小数据（id/name/type）按 type 分发给对应 normalizer 进行字段补全。
 *
 * 归属：magic-service Application 层。Mention 规范化天然需要聚合 Agent / MCP /
 * Flow 等多个领域的数据来补全运行时配置，按 DDD 分层只能在 Application 层完成
 * 跨领域聚合（Domain 层禁止依赖其它 Domain Service / Application Service）。
 */
class MentionNormalizationService
{
    protected LoggerInterface $logger;

    /**
     * type 到 normalizer 的映射表，在构造器内内嵌构建，normalize() 按 type O(1) 查表。
     *
     * @var array<string, MentionNormalizerInterface>
     */
    private readonly array $normalizers;

    public function __construct(
        ToolMentionNormalizer $toolNormalizer,
        AgentMentionNormalizer $agentNormalizer,
        McpMentionNormalizer $mcpNormalizer,
        private readonly PassthroughMentionNormalizer $passthroughNormalizer,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('MentionNormalizationService');
        $this->normalizers = [
            MentionType::TOOL->value => $toolNormalizer,
            MentionType::AGENT->value => $agentNormalizer,
            MentionType::MCP->value => $mcpNormalizer,
        ];
    }

    /**
     * 规范化 mentions 数组。
     *
     * @param array $mentions 原始 mentions（每项至少包含 type 字段）
     * @return array 规范化后的 mentions（保持顺序与数量不变）
     */
    public function normalize(array $mentions, BaseDataIsolation $dataIsolation): array
    {
        $out = [];
        foreach ($mentions as $item) {
            if (! is_array($item) || empty($item['type'])) {
                $out[] = $item;
                continue;
            }

            $type = (string) $item['type'];
            $normalizer = $this->normalizers[$type] ?? $this->passthroughNormalizer;
            $out[] = $normalizer->normalize($item, $dataIsolation);
        }
        return $out;
    }
}
