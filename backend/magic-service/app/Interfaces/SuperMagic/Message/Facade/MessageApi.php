<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Message\Facade;

use App\Application\SuperMagic\Message\Service\MessageQueueAppService;
use App\Application\SuperMagic\Message\Service\MessageQueueProcessAppService;
use App\Application\SuperMagic\Message\Service\MessageScheduleAppService;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use App\Interfaces\SuperMagic\Message\DTO\Request\ConsumeMessageQueueRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\CreateMessageQueueRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\CreateMessageScheduleRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\DeleteMessageQueueRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\MoveMessageQueueRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\QueryMessageQueueRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\QueryMessageScheduleLogsRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\QueryMessageScheduleRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\RestoreMessageQueueRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\UpdateMessageQueueRequestDTO;
use App\Interfaces\SuperMagic\Message\DTO\Request\UpdateMessageScheduleRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\HttpServer\Contract\RequestInterface;
use Throwable;

#[ApiResponse('low_code')]
class MessageApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected MessageQueueAppService $messageQueueAppService,
        protected MessageQueueProcessAppService $messageQueueProcessAppService,
        protected MessageScheduleAppService $messageScheduleAppService,
        protected TranslatorInterface $translator,
    ) {
        parent::__construct($request);
    }

    /**
     * Create message queue.
     *
     * @param RequestContext $requestContext Request context
     * @return array Operation result containing queue_id and status
     * @throws BusinessException If parameters are invalid or operation fails
     * @throws Throwable
     */
    public function createMessageQueue(RequestContext $requestContext): array
    {
        // Set user authorization information
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Create DTO from request
        $requestDTO = CreateMessageQueueRequestDTO::fromRequest($this->request);

        // Call application service to handle business logic
        return $this->messageQueueAppService->createMessage($requestContext, $requestDTO);
    }

    public function restoreMessageQueue(RequestContext $requestContext, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        return $this->messageQueueAppService->restoreMessage($requestContext, (int) $id, RestoreMessageQueueRequestDTO::fromRequest($this->request));
    }

    public function moveMessageQueue(RequestContext $requestContext, string $id): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        return $this->messageQueueAppService->moveMessage($requestContext, (int) $id, MoveMessageQueueRequestDTO::fromRequest($this->request));
    }

    /**
     * Update message queue.
     *
     * @param RequestContext $requestContext Request context
     * @param string $id Message queue ID
     * @return array Operation result containing queue_id and status
     * @throws BusinessException If parameters are invalid or operation fails
     * @throws Throwable
     */
    public function updateMessageQueue(RequestContext $requestContext, string $id): array
    {
        // Set user authorization information
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Create DTO from request
        $requestDTO = UpdateMessageQueueRequestDTO::fromRequest($this->request);

        // Call application service to handle business logic
        return $this->messageQueueAppService->updateMessage($requestContext, (int) $id, $requestDTO);
    }

    /**
     * Delete message queue.
     *
     * @param RequestContext $requestContext Request context
     * @param string $id Message queue ID
     * @return array Operation result containing affected rows
     * @throws BusinessException If parameters are invalid or operation fails
     * @throws Throwable
     */
    public function deleteMessageQueue(RequestContext $requestContext, string $id): array
    {
        // Set user authorization information
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Call application service to handle business logic
        return $this->messageQueueAppService->deleteMessage($requestContext, (int) $id, DeleteMessageQueueRequestDTO::fromRequest($this->request)->expectedSyncId);
    }

    /**
     * Query message queues.
     *
     * @param RequestContext $requestContext Request context
     * @return array Query result containing list and total
     * @throws BusinessException If parameters are invalid or operation fails
     * @throws Throwable
     */
    public function queryMessageQueues(RequestContext $requestContext): array
    {
        // Set user authorization information
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Create DTO from request
        $requestDTO = QueryMessageQueueRequestDTO::fromRequest($this->request);

        // Call application service to handle business logic
        return $this->messageQueueAppService->queryMessages($requestContext, $requestDTO);
    }

    /**
     * Consume message queue.
     *
     * @param RequestContext $requestContext Request context
     * @param string $id Message queue ID
     * @return array Operation result containing status
     * @throws BusinessException If parameters are invalid or operation fails
     * @throws Throwable
     */
    public function consumeMessageQueue(RequestContext $requestContext, string $id): array
    {
        // 1. Set user authorization information
        $requestContext->setUserAuthorization($this->getAuthorization());

        // 2. Create DTO from request (for future extensions)
        $requestDTO = ConsumeMessageQueueRequestDTO::fromRequest($this->request);

        // 3. Get and validate message (permission check)
        $messageId = (int) $id;
        $userId = $requestContext->getUserAuthorization()->getId();

        $messageEntity = $this->messageQueueAppService->getMessageQueueEntity($messageId, $userId);

        if (! $messageEntity || $messageEntity->getOrganizationCode() !== $requestContext->getUserAuthorization()->getOrganizationCode()) {
            throw new BusinessException(
                $this->translator->trans('message_queue.message_not_found')
            );
        }

        // 4. Check if message can be consumed
        if (! $messageEntity->canBeConsumed()) {
            throw new BusinessException(
                $this->translator->trans('message_queue.cannot_consume_message')
            );
        }

        // 5. Call MessageQueueProcessAppService to send message
        $sendResult = $this->messageQueueProcessAppService->processSingleMessage($messageId, $requestDTO->isForce());

        // 6. Return result
        return [
            'status' => $sendResult['success'] ? 'completed' : 'failed',
            'success' => $sendResult['success'],
            'error_message' => $sendResult['error_message'] ?? null,
        ];
    }

    /**
     * Create message schedule.
     *
     * @param RequestContext $requestContext Request context
     * @return array Operation result containing schedule_id
     * @throws BusinessException If parameters are invalid or operation fails
     * @throws Throwable
     */
    public function createMessageSchedule(RequestContext $requestContext): array
    {
        // Set user authorization information
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Create DTO from request
        $requestDTO = CreateMessageScheduleRequestDTO::fromRequest($this->request);

        // Call application service to handle business logic
        return $this->messageScheduleAppService->createSchedule($requestContext, $requestDTO);
    }

    /**
     * Update message schedule.
     *
     * @param RequestContext $requestContext Request context
     * @param string $id Message schedule ID
     * @return array Operation result containing schedule_id
     * @throws BusinessException If parameters are invalid or operation fails
     * @throws Throwable
     */
    public function updateMessageSchedule(RequestContext $requestContext, string $id): array
    {
        // Set user authorization information
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Create DTO from request
        $requestDTO = UpdateMessageScheduleRequestDTO::fromRequest($this->request);

        // Call application service to handle business logic
        return $this->messageScheduleAppService->updateSchedule($requestContext, (int) $id, $requestDTO);
    }

    /**
     * Delete message schedule.
     *
     * @param RequestContext $requestContext Request context
     * @param string $id Message schedule ID
     * @return array Operation result containing affected rows
     * @throws BusinessException If parameters are invalid or operation fails
     * @throws Throwable
     */
    public function deleteMessageSchedule(RequestContext $requestContext, string $id): array
    {
        // Set user authorization information
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Call application service to handle business logic
        return $this->messageScheduleAppService->deleteSchedule($requestContext, (int) $id);
    }

    /**
     * Query message schedules.
     *
     * @param RequestContext $requestContext Request context
     * @return array Query result containing list and total
     * @throws BusinessException If parameters are invalid or operation fails
     * @throws Throwable
     */
    public function queryMessageSchedules(RequestContext $requestContext): array
    {
        // Set user authorization information
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Create DTO from request
        $requestDTO = QueryMessageScheduleRequestDTO::fromRequest($this->request);

        // Call application service to handle business logic
        return $this->messageScheduleAppService->querySchedules($requestContext, $requestDTO);
    }

    /**
     * Get message schedule detail.
     *
     * @param RequestContext $requestContext Request context
     * @param string $id Message schedule ID
     * @return array Message schedule detail
     * @throws BusinessException If parameters are invalid or operation fails
     * @throws Throwable
     */
    public function getMessageScheduleDetail(RequestContext $requestContext, string $id): array
    {
        // Set user authorization information
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Call application service to handle business logic
        return $this->messageScheduleAppService->getScheduleDetail($requestContext, (int) $id);
    }

    /**
     * Get message schedule execution logs.
     *
     * @param RequestContext $requestContext Request context
     * @param string $id Message schedule ID
     * @return array Execution logs result with total count and list containing executed_at, task_name, workspace info, project info, topic info, status, and error_message
     * @throws BusinessException If parameters are invalid or operation fails
     * @throws Throwable
     */
    public function getMessageScheduleLogs(RequestContext $requestContext, string $id): array
    {
        // Set user authorization information
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Create DTO from request
        $requestDTO = QueryMessageScheduleLogsRequestDTO::fromRequest($this->request);

        // Call application service to handle business logic
        return $this->messageScheduleAppService->getScheduleLogs($requestContext, (int) $id, $requestDTO);
    }

    /**
     * Execute message schedule for testing purpose.
     * Validates that the schedule belongs to current user before execution.
     *
     * @param RequestContext $requestContext Request context
     * @param string $id Message schedule ID
     * @return array Execution result
     * @throws BusinessException If schedule not found or access denied
     * @throws Throwable
     */
    public function executeMessageScheduleForTest(RequestContext $requestContext, string $id): array
    {
        // Set user authorization information
        $requestContext->setUserAuthorization($this->getAuthorization());
        // Call application service with authorization check
        return $this->messageScheduleAppService->executeScheduleForTest($requestContext, (int) $id);
    }
}
