<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service\Mention\Normalizer;

use App\Application\Chat\Service\Mention\AbstractMentionNormalizer;
use App\Application\Flow\ExecuteManager\NodeRunner\LLM\ToolsExecutor;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;

/**
 * @tool mention 规范化：补全 json_schema / description / tool_name。
 *
 * mention 中 id 即 tool flow code，与
 * App\Application\MCP\BuiltInMCP\SuperMagicChat\SuperMagicChatManager::getTools()
 * 旧逻辑一致。
 */
class ToolMentionNormalizer extends AbstractMentionNormalizer
{
    protected function enrich(array $item, BaseDataIsolation $dataIsolation): array
    {
        $toolId = (string) ($item['id'] ?? '');
        if ($toolId === '') {
            return [];
        }

        // ToolsExecutor 需要 FlowDataIsolation，这里在 normalizer 内部自行转换
        $flowDataIsolation = FlowDataIsolation::create(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId()
        );

        $toolFlow = ToolsExecutor::getToolFlows($flowDataIsolation->disabled(), [$toolId])[0] ?? null;
        if ($toolFlow === null || ! $toolFlow->isEnabled()) {
            return [];
        }

        $jsonSchema = $toolFlow->getInput()?->getForm()?->getForm()?->toJsonSchema() ?? [];

        return [
            'tool_name' => $toolFlow->getName(),
            'description' => $toolFlow->getDescription(),
            'json_schema' => $jsonSchema,
        ];
    }
}
