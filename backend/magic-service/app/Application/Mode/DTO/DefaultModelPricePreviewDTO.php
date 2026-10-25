<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\DTO;

use DateTimeImmutable;

/** 默认文本模型价格白名单快照，不持有 Provider 完整实体或计算基准。 */
readonly class DefaultModelPricePreviewDTO
{
    private string $snapshotId;

    private string $generatedAt;

    /** 接收已经白名单投影的模式、分组、模型字典和完整性警告。 */
    public function __construct(
        private ?array $mode = null,
        private array $groups = [],
        private array $models = [],
        private array $warnings = [],
    ) {
        $this->snapshotId = bin2hex(random_bytes(16));
        $this->generatedAt = (new DateTimeImmutable())->format(DATE_ATOM);
    }

    /** 输出读取批次标记；空字典也保持 JSON 对象，不承诺跨表事务快照。 */
    public function toArray(): array
    {
        return [
            'snapshot_id' => $this->snapshotId,
            'generated_at' => $this->generatedAt,
            'scope' => 'default_text_models',
            'mode' => $this->mode,
            'calculation' => [
                'version' => 'text-reference-v1', 'input_tokens' => 10000, 'output_tokens' => 1000,
                'price_unit' => 'per_million_tokens', 'decimal_scale' => 36,
                'tier_aggregation' => 'equal_average', 'provider_aggregation' => 'equal_average',
            ],
            'groups' => $this->groups,
            'models' => (object) $this->models,
            'warnings' => $this->warnings,
        ];
    }
}
