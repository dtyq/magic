<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\Facade;

use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\Context\RequestContext;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\SuperAgent\Service\MessageQueueAppService;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\ConsumeMessageQueueRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\CreateMessageQueueRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\QueryMessageQueueRequestDTO;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request\UpdateMessageQueueRequestDTO;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\HttpServer\Contract\RequestInterface;
use Throwable;

#[ApiResponse('low_code')]
class MessageApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected MessageQueueAppService $messageQueueAppService,
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
        return $this->messageQueueAppService->deleteMessage($requestContext, (int) $id);
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
        // Set user authorization information
        $requestContext->setUserAuthorization($this->getAuthorization());

        // Create DTO from request
        $requestDTO = ConsumeMessageQueueRequestDTO::fromRequest($this->request);

        // Call application service to handle business logic
        return $this->messageQueueAppService->consumeMessage($requestContext, (int) $id, $requestDTO);
    }
}
