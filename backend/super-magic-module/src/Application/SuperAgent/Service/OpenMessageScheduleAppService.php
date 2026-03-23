<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\File\Service\FileDomainService;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Cron\CronExpression;
use DateTime;
use Dtyq\SuperMagic\Application\SuperAgent\Assembler\TaskConfigAssembler;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageScheduleEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\OpenMessageScheduleEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\Query\OpenMessageScheduleQuery;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\MessageScheduleDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\TimeConfigDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\OpenMessageScheduleDetailDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response\OpenMessageScheduleListItemDTO;
use Dtyq\TaskScheduler\Entity\TaskScheduler;
use Dtyq\TaskScheduler\Entity\TaskSchedulerCrontab;
use Dtyq\TaskScheduler\Entity\ValueObject\TaskType;
use Dtyq\TaskScheduler\Service\TaskSchedulerDomainService;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use Throwable;

use function Hyperf\Translation\trans;

/**
 * Open API Message Schedule Application Service.
 */
class OpenMessageScheduleAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        private readonly MessageScheduleDomainService $messageScheduleDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly ProviderModelDomainService $providerModelDomainService,
        private readonly FileDomainService $fileDomainService,
        private readonly TranslatorInterface $translator,
        private readonly TaskSchedulerDomainService $taskSchedulerDomainService,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    public function create(MagicUserAuthorization $authorization, OpenMessageScheduleEntity $entity): array
    {
        $dataIsolation = $this->createDataIsolation($authorization);

        // 补全llm端传来的不完整参数(topic_id是一定需要传递的)
        $topicEntity = $this->topicDomainService->validateTopicForMessageQueue($dataIsolation, $entity->getTopicId());
        $entity->setWorkspaceId((int) ($topicEntity->getWorkspaceId() ?? 0));
        $entity->setProjectId((int) $topicEntity->getProjectId());
        $entity->setMessageType('rich_text');
        $entity->setMessageContent(
            $this->buildFullMessageContent((string) $entity->getMessageContentText(), $this->buildModelFromProviderModelId((string) $entity->getModelId(), $dataIsolation))
        );

        // 业务校验当前用户是否有权限访问这个topic话题
        $this->getAccessibleProjectWithEditor(
            $entity->getProjectId(),
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );

        // 通过判断是否指定话题参数，变更topic_id的值(0就表示没有指定话题)
        if ($entity->getSpecifyTopic() === 0) {
            $entity->setTopicId(0);
        }

        try {
            // 计划时间参数转换和业务校验
            $timeConfigDTO = $this->createTimeConfigDTO($entity->getTimeConfig());
            $validationErrors = $timeConfigDTO->getValidationErrors();
            if (! empty($validationErrors)) {
                throw new InvalidArgumentException(implode(', ', $validationErrors));
            }

            // 定时任务消息和定时任务调度表插入数据
            return Db::transaction(function () use ($dataIsolation, $entity, $timeConfigDTO) {
                $scheduleId = IdGenerator::getSnowId();
                $taskSchedulerId = $this->createTaskScheduler(
                    $scheduleId,
                    $timeConfigDTO,
                    $entity->isEnabled(),
                    $entity->getDeadline(),
                    $entity->getTaskName()
                );

                $tempEntity = new MessageScheduleEntity();
                $tempEntity->setId($scheduleId);
                $tempEntity->setTimeConfig($entity->getTimeConfig());
                $tempEntity->setEnabled($entity->getEnabled());
                $tempEntity->setDeadline($entity->getDeadline());
                $tempEntity->setTaskSchedulerCrontabId($taskSchedulerId);
                $completed = $this->shouldMarkAsCompleted($tempEntity) ? 1 : 0;

                $currentTime = date('Y-m-d H:i:s');
                $entity->setId($scheduleId)
                    ->setTaskSchedulerCrontabId($taskSchedulerId)
                    ->setCompleted($completed)
                    ->setCreatedUid($dataIsolation->getCurrentUserId())
                    ->setUpdatedUid($dataIsolation->getCurrentUserId())
                    ->setCreatedAt($currentTime)
                    ->setUpdatedAt($currentTime);

                $this->messageScheduleDomainService->create($dataIsolation, $entity);

                return [
                    'id' => (string) $scheduleId,
                ];
            });
        } catch (InvalidArgumentException $e) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                $e->getMessage()
            );
        } catch (BusinessException $e) {
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error('Open schedule create operation system exception', [
                'operation' => 'create',
                'user_id' => $dataIsolation->getCurrentUserId(),
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'error' => $e->getMessage(),
            ]);

            ExceptionBuilder::throw(
                GenericErrorCode::SystemError,
                trans('common.system_exception')
            );
        }
    }

    public function update(MagicUserAuthorization $authorization, int $id, OpenMessageScheduleEntity $entity): array
    {
        $dataIsolation = $this->createDataIsolation($authorization);

        $messageSchedule = $this->messageScheduleDomainService->getMessageScheduleByIdWithValidation($dataIsolation, $id);
        $this->getAccessibleProjectWithEditor(
            $messageSchedule->getProjectId(),
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );

        try {
            return Db::transaction(function () use ($id, $dataIsolation, $messageSchedule, $entity) {
                // 由于参数很多不是必填的，所以下面做了很多判断
                $needUpdateTaskScheduler = false;

                if ($entity->hasTaskNameInput() && $entity->getTaskName() !== '') {
                    $messageSchedule->setTaskName($entity->getTaskName());
                }

                $this->applyOpenMessageContentUpdates($messageSchedule, $entity, $dataIsolation);

                if ($entity->hasEnabledInput()) {
                    $oldEnabled = $messageSchedule->getEnabled();
                    $messageSchedule->setEnabled($entity->getEnabled());
                    if ($oldEnabled !== $entity->getEnabled()) {
                        $needUpdateTaskScheduler = true;
                    }
                }

                if ($entity->hasTimeConfigInput()) {
                    $oldTimeConfig = $messageSchedule->getTimeConfig();
                    $newTimeConfig = $entity->getTimeConfig();
                    if (TimeConfigDTO::isConfigChanged($oldTimeConfig, $newTimeConfig)) {
                        $timeConfigDTO = $this->createTimeConfigDTO($newTimeConfig);
                        $validationErrors = $timeConfigDTO->getValidationErrors();
                        if (! empty($validationErrors)) {
                            throw new InvalidArgumentException(implode(', ', $validationErrors));
                        }

                        $messageSchedule->setTimeConfig($newTimeConfig);
                        $needUpdateTaskScheduler = true;
                    }
                }

                if ($entity->hasDeadlineInput()) {
                    $newDeadline = $entity->getDeadline();
                    $oldDeadline = $messageSchedule->getDeadline();
                    $oldNormalized = $oldDeadline === '' ? null : $oldDeadline;
                    if ($newDeadline !== $oldNormalized) {
                        $messageSchedule->setDeadline($newDeadline);
                        $needUpdateTaskScheduler = true;
                    }
                }

                if ($needUpdateTaskScheduler) {
                    $this->updateTaskScheduler($messageSchedule);
                    $shouldComplete = $this->shouldMarkAsCompleted($messageSchedule);
                    $messageSchedule->setCompleted($shouldComplete ? 1 : 0);

                    $this->logger->info('Updated open schedule completion status after scheduler update', [
                        'schedule_id' => $id,
                        'completed' => $shouldComplete ? 1 : 0,
                    ]);
                }

                $this->messageScheduleDomainService->updateMessageSchedule($dataIsolation, $messageSchedule);

                return [
                    'id' => (string) $messageSchedule->getId(),
                ];
            });
        } catch (InvalidArgumentException $e) {
            ExceptionBuilder::throw(
                GenericErrorCode::ParameterValidationFailed,
                trans('common.parameter_validation_error') . ': ' . $e->getMessage()
            );
        } catch (BusinessException $e) {
            throw $e;
        } catch (Throwable $e) {
            $this->logger->error('Open schedule update operation system exception', [
                'operation' => 'update',
                'schedule_id' => $id,
                'user_id' => $dataIsolation->getCurrentUserId(),
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
                'error' => $e->getMessage(),
            ]);

            ExceptionBuilder::throw(
                GenericErrorCode::SystemError,
                trans('common.system_exception')
            );
        }
    }

    public function queries(MagicUserAuthorization $authorization, OpenMessageScheduleQuery $query): array
    {
        $dataIsolation = $this->createDataIsolation($authorization);

        // 这里只能查询当前项目下的全部定时任务，因此做一个业务校验
        $projectId = $query->getProjectId();
        $this->getAccessibleProjectWithEditor(
            (int) $projectId,
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );

        // 构建当前项目下专属于个人建立查询条件
        $conditions = $query->toConditions(
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );
        $conditions['project_id'] = (int) $projectId;

        $result = $this->messageScheduleDomainService->getMessageSchedulesByConditions(
            $conditions,
            $query->getPage(),
            $query->getPageSize(),
            $query->getOrderBy(),
            $query->getOrderDirection()
        );

        $list = [];
        foreach ($result['list'] as $entity) {
            $list[] = OpenMessageScheduleListItemDTO::fromEntity($entity)->toArray();
        }

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
    }

    public function show(MagicUserAuthorization $authorization, int $id): array
    {
        $dataIsolation = $this->createDataIsolation($authorization);
        $entity = $this->messageScheduleDomainService->getMessageScheduleByIdWithValidation($dataIsolation, $id);
        return OpenMessageScheduleDetailDTO::fromEntity($entity)->toArray();
    }

    public function delete(MagicUserAuthorization $authorization, int $id): array
    {
        $dataIsolation = $this->createDataIsolation($authorization);
        $messageSchedule = $this->messageScheduleDomainService->getMessageScheduleByIdWithValidation($dataIsolation, $id);
        $this->getAccessibleProjectWithEditor(
            $messageSchedule->getProjectId(),
            $dataIsolation->getCurrentUserId(),
            $dataIsolation->getCurrentOrganizationCode()
        );

        return Db::transaction(function () use ($id, $dataIsolation, $messageSchedule) {
            if ($messageSchedule->hasTaskScheduler()) {
                $this->deleteTaskScheduler($messageSchedule->getId());
            }

            $this->messageScheduleDomainService->deleteMessageSchedule($dataIsolation, $id);

            return [
                'id' => (string) $id,
            ];
        });
    }

    protected function buildFullMessageContent(string $userText, array $model): array
    {
        $escapedText = json_encode($userText, JSON_UNESCAPED_UNICODE);
        $contentJson = '{"type":"doc","content":[{"type":"paragraph","attrs":{"suggestion":""},"content":[{"type":"text","text":' . $escapedText . '}]}]}';
        return [
            'content' => $contentJson,
            'extra' => [
                'super_agent' => [
                    'model' => $model,
                    'mentions' => [],
                    'chat_mode' => 'normal',
                    'input_mode' => 'plan',
                    'topic_pattern' => 'general',
                ],
            ],
        ];
    }

    protected function buildModelFromProviderModelId(string $modelId, DataIsolation $dataIsolation): array
    {
        $provider = $this->providerModelDomainService->getModelByModelId($modelId);
        if ($provider === null) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'model_not_found');
        }

        $modelIcon = $provider->getIcon();
        $link = $this->fileDomainService->getLink($dataIsolation->getCurrentOrganizationCode(), $modelIcon);
        if ($link !== null) {
            $modelIcon = $link->getUrl();
        }

        $locale = $this->translator->getLocale();
        $translate = $provider->getTranslate();
        $status = $provider->getStatus();
        $modelStatus = $status !== null && $status === Status::Enabled ? 'normal' : 'disabled';

        return [
            'id' => (string) $provider->getId(),
            'model_id' => $provider->getModelId(),
            'model_icon' => $modelIcon,
            'model_name' => $provider->getName(),
            'model_description' => (! isset($translate['description'][$locale]))
                ? $provider->getDescription()
                : $translate['description'][$locale],
            'provider_model_id' => (string) $provider->getId(),
            'model_status' => $modelStatus,
            'image_size_config' => null,
            'sort' => $provider->getSort(),
            'tags' => [],
            'topic_pattern' => 'general',
        ];
    }

    protected function createTimeConfigDTO(array $timeConfig): TimeConfigDTO
    {
        $timeConfigDTO = new TimeConfigDTO();
        $timeConfigDTO->type = $timeConfig['type'] ?? '';
        $timeConfigDTO->day = $timeConfig['day'] ?? '';
        $timeConfigDTO->time = $timeConfig['time'] ?? '';
        $timeConfigDTO->value = $timeConfig['value'] ?? [];

        return $timeConfigDTO;
    }

    protected function createTaskScheduler(
        int $messageScheduleId,
        TimeConfigDTO $timeConfigDTO,
        bool $enabled = true,
        ?string $priorityDeadline = null,
        ?string $taskName = null
    ): ?int {
        try {
            $taskConfig = TaskConfigAssembler::assembleFromDTO($timeConfigDTO);
            $externalId = "message_schedule_{$messageScheduleId}";
            $callbackMethod = [MessageScheduleAppService::class, 'messageScheduleCallback'];
            $callbackParams = [
                'message_schedule_id' => $messageScheduleId,
            ];

            if ($taskConfig->getType() === TaskType::NoRepeat) {
                $task = new TaskScheduler();
                $task->setExternalId($externalId);
                $task->setName($taskName ?: "Message Schedule {$messageScheduleId}");
                $task->setExpectTime($taskConfig->getDatetime());
                $task->setType(2);
                $task->setRetryTimes(3);
                $task->setCallbackMethod($callbackMethod);
                $task->setCallbackParams($callbackParams);
                $task->setCreator('system');

                $this->taskSchedulerDomainService->create($task);
                return null;
            }

            $crontab = new TaskSchedulerCrontab();
            $crontab->setExternalId($externalId);
            $crontab->setName($taskName ?: "Message Schedule {$messageScheduleId}");
            $crontab->setCrontab($taskConfig->getCrontabRule());
            $crontab->setEnabled($enabled);
            $crontab->setRetryTimes(3);
            $crontab->setCallbackMethod($callbackMethod);
            $crontab->setCallbackParams($callbackParams);
            $finalDeadline = null;
            if (! empty($priorityDeadline)) {
                $finalDeadline = new DateTime($priorityDeadline);
            } elseif ($taskConfig->getDeadline()) {
                $finalDeadline = $taskConfig->getDeadline();
            }
            $crontab->setDeadline($finalDeadline);
            $crontab->setCreator('system');

            $this->taskSchedulerDomainService->createCrontab($crontab);
            $this->taskSchedulerDomainService->createByCrontab($crontab, 3);

            return $crontab->getId();
        } catch (Throwable $e) {
            $this->logger->error('Failed to create open task scheduler', [
                'message_schedule_id' => $messageScheduleId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    protected function updateTaskScheduler(MessageScheduleEntity $messageSchedule): void
    {
        try {
            $this->deleteTaskScheduler($messageSchedule->getId());

            $taskSchedulerId = null;
            if ($messageSchedule->isEnabled()) {
                $timeConfigDTO = $this->createTimeConfigDTO($messageSchedule->getTimeConfig());
                $taskSchedulerId = $this->createTaskScheduler(
                    $messageSchedule->getId(),
                    $timeConfigDTO,
                    $messageSchedule->isEnabled(),
                    $messageSchedule->getDeadline(),
                    $messageSchedule->getTaskName()
                );
            }

            $messageSchedule->setTaskSchedulerCrontabId($taskSchedulerId);
        } catch (Throwable $e) {
            $this->logger->error('Failed to update open task scheduler', [
                'message_schedule_id' => $messageSchedule->getId(),
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    protected function deleteTaskScheduler(int $messageScheduleId): void
    {
        try {
            $externalId = "message_schedule_{$messageScheduleId}";
            $this->taskSchedulerDomainService->clearByExternalId($externalId);
        } catch (Throwable $e) {
            $this->logger->error('Failed to delete open task scheduler', [
                'message_schedule_id' => $messageScheduleId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    protected function getNextExecutionTime(?int $crontabId): ?string
    {
        if (! $crontabId) {
            return null;
        }

        try {
            $crontab = $this->taskSchedulerDomainService->getByCrontabId($crontabId);
            if (! $crontab || ! $crontab->isEnabled()) {
                return null;
            }

            if ($crontab->getDeadline() && $crontab->getDeadline() < new DateTime()) {
                return null;
            }

            $cron = new CronExpression($crontab->getCrontab());
            $nextRun = $cron->getNextRunDate();

            return $nextRun->format('Y-m-d H:i:s');
        } catch (Throwable $e) {
            $this->logger->error('Failed to calculate next open execution time', [
                'crontab_id' => $crontabId,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    protected function shouldMarkAsCompleted(MessageScheduleEntity $messageSchedule): bool
    {
        $timeConfig = $messageSchedule->getTimeConfig();
        $taskType = $timeConfig['type'] ?? '';
        $currentTime = date('Y-m-d H:i:s');

        if ($taskType === TaskType::NoRepeat->value) {
            $day = $timeConfig['day'] ?? '';
            $time = $timeConfig['time'] ?? '';

            if (empty($day) || empty($time)) {
                return true;
            }

            $timeParts = explode(':', $time);
            if (count($timeParts) === 2) {
                $time .= ':00';
            }
            $executionTime = $day . ' ' . $time;

            return $executionTime <= $currentTime;
        }

        if (! $messageSchedule->hasTaskScheduler()) {
            return true;
        }

        $nextExecutionTime = $this->getNextExecutionTime($messageSchedule->getTaskSchedulerCrontabId());
        if ($nextExecutionTime === null) {
            return true;
        }

        $deadline = $messageSchedule->getDeadline();
        if ($deadline !== null && $nextExecutionTime > $deadline) {
            return true;
        }

        return false;
    }

    private function applyOpenMessageContentUpdates(
        MessageScheduleEntity $messageSchedule,
        OpenMessageScheduleEntity $entity,
        DataIsolation $dataIsolation
    ): void {
        if (! $entity->hasMessageContentTextInput() && ! $entity->hasModelIdInput()) {
            return;
        }

        $messageContent = $messageSchedule->getMessageContent();

        if ($entity->hasModelIdInput()) {
            // 传了 model_id，查 DB 获取并验证新 model
            $model = $this->buildModelFromProviderModelId(
                (string) $entity->getModelId(),
                $dataIsolation
            );

            if ($entity->hasMessageContentTextInput()) {
                // 同时传了 message_content，用新 model 重建完整消息内容
                $messageSchedule->setMessageContent(
                    $this->buildFullMessageContent($entity->getMessageContentText() ?? '', $model)
                );
                return;
            }

            // 只传了 model_id，仅替换存量内容中的 model 字段
            if (! isset($messageContent['extra']) || ! is_array($messageContent['extra'])) {
                $messageContent['extra'] = [];
            }
            if (! isset($messageContent['extra']['super_agent']) || ! is_array($messageContent['extra']['super_agent'])) {
                $messageContent['extra']['super_agent'] = [];
            }
            $messageContent['extra']['super_agent']['model'] = $model;
            $messageSchedule->setMessageContent($messageContent);
            return;
        }

        // 只传了 message_content，复用存量 model，不查 DB
        $existingModel = $messageContent['extra']['super_agent']['model'] ?? [];
        $messageSchedule->setMessageContent(
            $this->buildFullMessageContent($entity->getMessageContentText() ?? '', $existingModel)
        );
    }
}
