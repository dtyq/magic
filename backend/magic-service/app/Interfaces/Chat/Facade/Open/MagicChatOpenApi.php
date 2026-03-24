<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Facade\Open;

use App\Application\Agent\Service\MagicAgentAppService;
use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\Chat\Service\MagicControlMessageAppService;
use App\Application\Chat\Service\MagicConversationAppService;
use App\Domain\Chat\DTO\MessagesQueryDTO;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\Constants\Order;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Context\RequestCoContext;
use Carbon\Carbon;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;

#[ApiResponse('low_code')]
class MagicChatOpenApi extends AbstractApi
{
    public function __construct(
        private readonly ValidatorFactoryInterface $validatorFactory,
        private readonly MagicChatMessageAppService $magicChatMessageAppService,
        private readonly MagicConversationAppService $magicConversationAppService,
        protected readonly MagicAgentAppService $magicAgentAppService,
        protected readonly MagicControlMessageAppService $magicControlMessageAppService,
    ) {
    }

    /**
     * 会话窗口滚动加载消息.
     */
    public function messageQueries(RequestInterface $request): array
    {
        // 1. Get user authorization from coroutine context
        $userAuthorization = RequestCoContext::getUserAuthorization();
        if (empty($userAuthorization)) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterMissing, 'user_authorization_not_found');
        }

        $params = $request->all();
        $rules = [
            'topic_id' => 'string',
            'time_start' => 'string|nullable',
            'time_end' => 'string|nullable',
            'page_token' => 'string｜nullable',
            'limit' => 'int',
            'order' => 'string',
        ];
        $params = $this->checkParams($params, $rules);
        $timeStart = ! empty($params['time_start']) ? new Carbon($params['time_start']) : null;
        $timeEnd = ! empty($params['time_end']) ? new Carbon($params['time_end']) : null;
        $order = ! empty($params['order']) ? Order::from($params['order']) : Order::Asc;
        $conversationMessagesQueryDTO = (new MessagesQueryDTO())
            ->setTopicId($params['topic_id'] ?? '')
            ->setTimeStart($timeStart)
            ->setTimeEnd($timeEnd)
            ->setPageToken($params['page_token'] ?? '')
            ->setLimit($params['limit'] ?? 100)
            ->setOrder($order);
        $authorization = $this->getAuthorization();

        $conversationInfo = $this->magicConversationAppService->getConversationIdByAgentTopicIdAndUserId((int) $conversationMessagesQueryDTO->getTopicId(), $userAuthorization->getId());
        if (empty($conversationInfo)) {
            throw new BusinessException('Conversation not found');
        }
        $conversationId = $conversationInfo[0];
        $topicId = $conversationInfo[1];
        $conversationMessagesQueryDTO->setConversationId($conversationId)->setTopicId($topicId);
        return $this->magicChatMessageAppService->getMessagesByConversationId($authorization, $conversationId, $conversationMessagesQueryDTO);
    }

    /**
     * @param null|string $method 有时候字段没有区分度，需要加上方法名
     */
    protected function checkParams(array $params, array $rules, ?string $method = null): array
    {
        $validator = $this->validatorFactory->make($params, $rules);
        if ($validator->fails()) {
            $errMsg = $validator->errors()->first();
            $method && $errMsg = $method . ': ' . $errMsg;
            throw new BusinessException($errMsg);
        }
        $validator->validated();
        return $params;
    }
}
