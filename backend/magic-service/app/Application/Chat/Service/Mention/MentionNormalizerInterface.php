<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service\Mention;

use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;

/**
 * Mention 规范化处理器契约。
 *
 * 每个实现负责一种 mention type，把前端最小数据补全为 super-magic
 * 端可直接消费的完整结构（如 tool 的 json_schema、agent 的 flow_code、
 * mcp 的 url/command/headers/token 等运行时配置）。
 *
 * 传入 BaseDataIsolation 作为最小公共依赖；如果某个实现需要
 * FlowDataIsolation / MCPDataIsolation 等领域专属隔离，由实现内部自行转换。
 */
interface MentionNormalizerInterface
{
    /**
     * @param array $item 单条 mention 数据（来自前端）
     * @return array 规范化后的 mention 单项（必须保留 type、id/agent_id、name 等原始字段）
     */
    public function normalize(array $item, BaseDataIsolation $dataIsolation): array;
}
