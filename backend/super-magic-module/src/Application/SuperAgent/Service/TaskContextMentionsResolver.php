<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\Chat\Service\Mention\MentionNormalizationService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskContext;
use Hyperf\Codec\Json;

/**
 * TaskContext 的 mentions 规范化解析器（Application 层）.
 *
 * 职责：
 * - 在 sendChatMessage 进入 Domain 层之前，对 task.mentions 的 JSON 字符串进行规范化，
 *   然后将规范化后的结果重新编码为 JSON 字符串、回写回 TaskEntity.mentions，
 *   保持 Domain 层原始数据结构不变。
 * - 这样 Domain 层 (AgentDomainService) 不再需要感知 MentionNormalizationService
 *   及其依赖的多个跨域 App/Domain Service，符合 DDD 分层原则。
 */
class TaskContextMentionsResolver
{
    public function __construct(
        private readonly MentionNormalizationService $mentionNormalizationService,
    ) {
    }

    /**
     * 规范化 task.mentions 后回写同一字段（仍为 JSON 字符串）。
     */
    public function resolve(TaskContext $taskContext, DataIsolation $dataIsolation): void
    {
        $task = $taskContext->getTask();
        $mentionsArray = $this->normalize($task->getMentions(), $dataIsolation);
        if ($mentionsArray === []) {
            return;
        }
        $task->setMentions(Json::encode($mentionsArray));
    }

    /**
     * 仅做规范化处理，返回结果数组（不写回 TaskContext）.
     *
     * @param null|string $mentionsJson mentions 的 JSON 字符串
     * @return array 规范化后的 mentions 数组
     */
    public function normalize(?string $mentionsJson, DataIsolation $dataIsolation): array
    {
        if (! ($mentionsJson && json_validate($mentionsJson))) {
            return [];
        }
        $mentions = (array) Json::decode($mentionsJson);
        if (empty($mentions)) {
            return [];
        }

        // 传递最小公共依赖 BaseDataIsolation；normalizer 内部如需
        // FlowDataIsolation / MCPDataIsolation 自行转换。
        $baseDataIsolation = new BaseDataIsolation(
            $dataIsolation->getCurrentOrganizationCode(),
            $dataIsolation->getCurrentUserId()
        );

        return $this->mentionNormalizationService->normalize($mentions, $baseDataIsolation);
    }
}
