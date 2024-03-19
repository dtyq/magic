<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Application\Speech\DTO\AsrTaskStatusDTO;
use App\Domain\Asr\Service\AsrTaskDomainService;
use App\ErrorCode\AsrErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Application\SuperAgent\Service\AbstractAppService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;

/**
 * ASR 验证服务
 * 负责项目权限、话题归属、任务状态等验证逻辑.
 */
class AsrValidationService extends AbstractAppService
{
    public function __construct(
        private readonly TopicDomainService $topicDomainService,
        private readonly AsrTaskDomainService $asrTaskDomainService
    ) {
    }

    /**
     * 验证话题归属.
     *
     * @param int $topicId 话题ID
     * @param string $userId 用户ID
     * @return TopicEntity 话题实体
     */
    public function validateTopicOwnership(int $topicId, string $userId): TopicEntity
    {
        $topicEntity = $this->topicDomainService->getTopicById($topicId);

        if ($topicEntity === null) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND);
        }

        // 验证话题属于当前用户
        if ($topicEntity->getUserId() !== $userId) {
            ExceptionBuilder::throw(SuperAgentErrorCode::TOPIC_NOT_FOUND);
        }

        return $topicEntity;
    }

    /**
     * 验证并获取任务状态.
     *
     * @param string $taskKey 任务键
     * @param string $userId 用户ID
     * @return AsrTaskStatusDTO 任务状态DTO
     */
    public function validateTaskStatus(string $taskKey, string $userId): AsrTaskStatusDTO
    {
        $taskStatus = $this->asrTaskDomainService->findTaskByKey($taskKey, $userId);

        if ($taskStatus === null) {
            ExceptionBuilder::throw(AsrErrorCode::UploadAudioFirst);
        }

        // 验证用户ID匹配（基本的安全检查）
        if ($taskStatus->userId !== $userId) {
            ExceptionBuilder::throw(AsrErrorCode::TaskNotBelongToUser);
        }

        return $taskStatus;
    }

    /**
     * 从话题获取项目ID（包含话题归属验证）.
     *
     * @param int $topicId 话题ID
     * @param string $userId 用户ID
     * @return string 项目ID
     */
    public function getProjectIdFromTopic(int $topicId, string $userId): string
    {
        $topicEntity = $this->validateTopicOwnership($topicId, $userId);

        // ASR upload_token 场景：若话题的 topic_mode 为空，则默认补齐为 summary（幂等）
        if (trim($topicEntity->getTopicMode()) === '') {
            $topicEntity->setTopicMode('summary');
            $topicEntity->setUpdatedUid($userId);
            $topicEntity->setUpdatedAt(date('Y-m-d H:i:s'));
            $this->topicDomainService->saveTopicEntity($topicEntity);
        }

        return (string) $topicEntity->getProjectId();
    }
}
