<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service\Mention;

use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Mention 规范化处理器公共骨架。
 *
 * 子类只需实现 enrich()，base 自动负责异常容忍：
 * 单条 mention enrich 失败仅记录 warning 并保留原始数据，避免阻断会话主流程。
 */
abstract class AbstractMentionNormalizer implements MentionNormalizerInterface
{
    protected LoggerInterface $logger;

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get('MentionNormalizer');
    }

    public function normalize(array $item, BaseDataIsolation $dataIsolation): array
    {
        try {
            $extra = $this->enrich($item, $dataIsolation);
            return array_merge($item, $extra);
        } catch (Throwable $e) {
            $this->logger->warning('[MentionNormalizer] enrich failed', [
                'normalizer' => static::class,
                'type' => $item['type'] ?? null,
                'id' => $item['id'] ?? ($item['agent_id'] ?? null),
                'message' => $e->getMessage(),
            ]);
            return $item;
        }
    }

    /**
     * 仅返回需要合并到原 mention 上的增量字段；不需要包含原始字段。
     */
    abstract protected function enrich(array $item, BaseDataIsolation $dataIsolation): array;
}
