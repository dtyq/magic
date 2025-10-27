<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Service;

use App\Domain\Asr\Service\AsrTaskDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicDepartmentUserDomainService;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\ExternalAPI\Volcengine\DTO\AsrTaskStatusDTO;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;
use InvalidArgumentException;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * ASR 验证服务
 * 负责项目权限、话题归属、任务状态等验证逻辑.
 */
readonly class AsrValidationService
{
    public function __construct(
        private ProjectDomainService $projectDomainService,
        private ProjectMemberDomainService $projectMemberDomainService,
        private MagicDepartmentUserDomainService $magicDepartmentUserDomainService,
        private TopicDomainService $topicDomainService,
        private AsrTaskDomainService $asrTaskDomainService
    ) {
    }

    /**
     * 验证项目权限 - 确保项目属于当前用户和组织.
     *
     * @param string $projectId 项目ID
     * @param string $userId 用户ID
     * @param string $organizationCode 组织编码
     * @return ProjectEntity 项目实体
     * @throws InvalidArgumentException 当项目不存在或无权限时抛出异常
     */
    public function validateProjectAccess(string $projectId, string $userId, string $organizationCode): ProjectEntity
    {
        try {
            // 获取项目信息
            $projectEntity = $this->projectDomainService->getProjectNotUserId((int) $projectId);
            if ($projectEntity === null) {
                ExceptionBuilder::throw(SuperAgentErrorCode::PROJECT_NOT_FOUND);
            }

            // 校验项目是否属于当前组织
            if ($projectEntity->getUserOrganizationCode() !== $organizationCode) {
                throw new InvalidArgumentException(trans('asr.api.validation.project_access_denied_organization'));
            }

            // 校验项目是否属于当前用户
            if ($projectEntity->getUserId() === $userId) {
                return $projectEntity;
            }

            // 检查用户是否是项目成员
            if ($this->projectMemberDomainService->isProjectMemberByUser((int) $projectId, $userId)) {
                return $projectEntity;
            }

            // 检查用户所在部门是否有项目权限
            $dataIsolation = DataIsolation::create($organizationCode, $userId);
            $departmentIds = $this->magicDepartmentUserDomainService->getDepartmentIdsByUserId($dataIsolation, $userId, true);

            if (! empty($departmentIds) && $this->projectMemberDomainService->isProjectMemberByDepartments((int) $projectId, $departmentIds)) {
                return $projectEntity;
            }

            // 所有权限检查都失败
            throw new InvalidArgumentException(trans('asr.api.validation.project_access_denied_user'));
        } catch (BusinessException $e) {
            // 处理 ExceptionBuilder::throw 抛出的业务异常
            if ($e->getCode() === SuperAgentErrorCode::PROJECT_NOT_FOUND->value) {
                throw new InvalidArgumentException(trans('asr.api.validation.project_not_found'));
            }

            // 其他业务异常转换为权限验证失败
            throw new InvalidArgumentException(trans('asr.api.validation.project_access_validation_failed', ['error' => $e->getMessage()]));
        } catch (InvalidArgumentException $e) {
            // 重新抛出权限相关异常
            throw $e;
        } catch (Throwable $e) {
            // 其他异常统一处理为权限验证失败
            throw new InvalidArgumentException(trans('asr.api.validation.project_access_validation_failed', ['error' => $e->getMessage()]));
        }
    }

    /**
     * 验证话题归属.
     *
     * @param int $topicId 话题ID
     * @param string $userId 用户ID
     * @return TopicEntity 话题实体
     * @throws InvalidArgumentException 当话题不存在或不属于当前用户时
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
     * @throws InvalidArgumentException 当任务不存在或不属于当前用户时
     */
    public function validateTaskStatus(string $taskKey, string $userId): AsrTaskStatusDTO
    {
        $taskStatus = $this->asrTaskDomainService->findTaskByKey($taskKey, $userId);

        if ($taskStatus === null) {
            throw new InvalidArgumentException(trans('asr.api.validation.upload_audio_first'));
        }

        // 验证用户ID匹配（基本的安全检查）
        if ($taskStatus->userId !== $userId) {
            throw new InvalidArgumentException(trans('asr.exception.task_not_belong_to_user'));
        }

        return $taskStatus;
    }

    /**
     * 从话题获取项目ID（包含话题归属验证）.
     *
     * @param int $topicId 话题ID
     * @param string $userId 用户ID
     * @return string 项目ID
     * @throws InvalidArgumentException 当话题不存在或不属于当前用户时
     */
    public function getProjectIdFromTopic(int $topicId, string $userId): string
    {
        $topicEntity = $this->validateTopicOwnership($topicId, $userId);
        return (string) $topicEntity->getProjectId();
    }
}
