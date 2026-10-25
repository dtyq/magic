<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Topic\Facade\OpenApi;

use App\Application\SuperMagic\Topic\Service\TopicAppService;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use App\Interfaces\SuperMagic\Topic\DTO\Request\DeleteTopicRequestDTO;
use App\Interfaces\SuperMagic\Topic\DTO\Request\SaveTopicRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * Open Topic API.
 * Provides API Key authenticated endpoints for topic management.
 */
#[ApiResponse('low_code')]
class OpenTopicApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        protected TopicAppService $topicAppService,
    ) {
        parent::__construct($request);
    }

    /**
     * Get topic detail for the authenticated user.
     */
    public function getTopic(RequestContext $requestContext, string $id): array
    {
        $this->setRequestAuthorization($requestContext);

        return $this->topicAppService->getTopic($requestContext, (int) $id)->toArray();
    }

    /**
     * Create a topic for the authenticated user.
     */
    public function createTopic(RequestContext $requestContext): array
    {
        $this->setRequestAuthorization($requestContext);
        $requestDTO = SaveTopicRequestDTO::fromRequest($this->request);

        return $this->topicAppService->createTopic($requestContext, $requestDTO)->toArray();
    }

    /**
     * Update a topic owned by the authenticated user.
     */
    public function updateTopic(RequestContext $requestContext, string $id): array
    {
        $this->setRequestAuthorization($requestContext);
        $requestDTO = SaveTopicRequestDTO::fromRequest($this->request);
        $requestDTO->id = $id;

        return $this->topicAppService->updateTopic($requestContext, $requestDTO)->toArray();
    }

    /**
     * Logically delete a topic owned by the authenticated user.
     */
    public function deleteTopic(RequestContext $requestContext): array
    {
        $this->setRequestAuthorization($requestContext);
        $requestDTO = DeleteTopicRequestDTO::fromRequest($this->request);

        return $this->topicAppService->deleteTopic($requestContext, $requestDTO)->toArray();
    }

    private function setRequestAuthorization(RequestContext $requestContext): void
    {
        $userAuthorization = RequestCoContext::getUserAuthorization();
        if (empty($userAuthorization)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_authorization_not_found');
        }

        $requestContext->setUserAuthorization($userAuthorization);
    }
}
