<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Domain\Chat\Entity\MagicGeneratedSuggestionEntity;
use App\Domain\Chat\Entity\ValueObject\GeneratedSuggestionType;
use App\Domain\Chat\Service\MagicGeneratedSuggestionDomainService;
use App\Domain\SuperMagic\Task\Service\TaskDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\Assembler\MagicGeneratedSuggestionAssembler;
use App\Interfaces\Chat\DTO\Response\FollowUpSuggestionQueryResponseDTO;
use App\Interfaces\SuperMagic\Task\DTO\Request\FollowUpSuggestionReportRequestDTO;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 追加问题只负责查询和沙箱上报入库，不再生成内容。
 */
class FollowUpSuggestionAppService extends AbstractAppService
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly MagicGeneratedSuggestionDomainService $generatedSuggestionDomainService,
        private readonly TaskDomainService $taskDomainService,
        private readonly TopicDomainService $topicDomainService,
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    /**
     * 通用查询入口：按 type + relation_id 查询建议结果。
     */
    public function queryFollowUpSuggestions(MagicGeneratedSuggestionEntity $criteria): FollowUpSuggestionQueryResponseDTO
    {
        $entity = $this->generatedSuggestionDomainService->queryByCriteria($criteria);

        return MagicGeneratedSuggestionAssembler::entityToQueryResponseDto($entity);
    }

    /**
     * 接收沙箱上报。无权限和任务不存在使用同一拒绝，避免暴露任务是否存在。
     *
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function report(?MagicUserAuthorization $authorization, array $payload): array
    {
        $report = FollowUpSuggestionReportRequestDTO::fromPayload($payload);
        $userId = $authorization?->getId() ?? '';
        $organizationCode = $authorization?->getOrganizationCode() ?? '';
        if ($userId === '' || $organizationCode === '') {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'access_denied');
        }

        $task = $this->taskDomainService->getTaskById((int) $report->taskId);
        $topic = $task === null ? null : $this->topicDomainService->getTopicById($task->getTopicId());
        if (
            $task === null
            || $topic === null
            || $task->getUserId() !== $userId
            || $topic->getUserId() !== $userId
            || $topic->getUserOrganizationCode() !== $organizationCode
        ) {
            ExceptionBuilder::throw(GenericErrorCode::AccessDenied, 'access_denied');
        }

        try {
            $entity = $this->generatedSuggestionDomainService->saveReport(
                GeneratedSuggestionType::SUPER_MAGIC_TOPIC_FOLLOW_UP,
                $report->taskId,
                $report->status,
                $report->suggestions,
                $task->getUserId(),
                $this->buildReportParams($report->taskId, $task->getTopicId()),
            );
        } catch (Throwable $throwable) {
            $this->logger->warning('保存追加问题上报失败', [
                'exception_class' => $throwable::class,
                'task_id' => $report->taskId,
            ]);
            ExceptionBuilder::throw(GenericErrorCode::SystemError, 'system_exception');
        }

        return [
            'type' => $entity->getType(),
            'relation_id' => $entity->getRelationId(),
            'status' => $entity->getStatus()?->value,
            'suggestions' => $entity->getSuggestions(),
        ];
    }

    /**
     * 只记录来源。对话内容和凭证不进入 params。
     *
     * @return array<string, string>
     */
    private function buildReportParams(string $taskId, int $topicId): array
    {
        return [
            'source' => 'super_magic',
            'generator' => 'follow_up_suggestion',
            'task_id' => $taskId,
            'topic_id' => (string) $topicId,
        ];
    }
}
