<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\Facade;

use App\Application\Agent\Service\MagicAgentAppService;
use App\Application\Chat\Service\MagicChatGroupAppService;
use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\Chat\Service\MagicControlMessageAppService;
use App\Application\Chat\Service\MagicConversationAppService;
use App\Domain\Chat\DTO\ChatCompletionsDTO;
use App\Domain\Chat\DTO\ConversationListQueryDTO;
use App\Domain\Chat\DTO\Message\ControlMessage\InstructMessage;
use App\Domain\Chat\DTO\MessagesQueryDTO;
use App\Domain\Chat\Entity\MagicChatFileEntity;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\FileType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Group\Entity\MagicGroupEntity;
use App\Domain\Group\Entity\ValueObject\GroupStatusEnum;
use App\Domain\Group\Entity\ValueObject\GroupTypeEnum;
use App\ErrorCode\AgentErrorCode;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Constants\Order;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Chat\Assembler\ConversationAssembler;
use App\Interfaces\Chat\Assembler\PageListAssembler;
use Carbon\Carbon;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Codec\Json;
use Hyperf\Contract\StdoutLoggerInterface;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Redis\Redis;
use Hyperf\Validation\Contract\ValidatorFactoryInterface;
use Hyperf\Validation\Rule;
use Throwable;

#[ApiResponse('low_code')]
class MagicChatHttpApi extends AbstractApi
{
    public function __construct(
        private readonly ValidatorFactoryInterface $validatorFactory,
        private readonly StdoutLoggerInterface $logger,
        private readonly MagicChatMessageAppService $magicChatMessageAppService,
        private readonly MagicConversationAppService $magicConversationAppService,
        private readonly MagicChatGroupAppService $chatGroupAppService,
        protected readonly MagicAgentAppService $magicAgentAppService,
        protected readonly MagicControlMessageAppService $magicControlMessageAppService,
        private readonly Redis $redis,
    ) {
    }

    /**
     * 拉取用户的收件消息.
     * @throws Throwable
     */
    public function pullByPageToken(RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'page_token' => 'string', // 私聊的本地最大 seq_id
        ];
        $params = $this->checkParams($params, $rules);
        $this->logger->info('pullMessage:' . Json::encode($params));
        $authorization = $this->getAuthorization();
        return $this->magicChatMessageAppService->pullByPageToken($authorization, $params);
    }

    public function pullByAppMessageId(RequestInterface $request, string $appMessageId): array
    {
        $params = $request->all();
        $rules = [
            'page_token' => 'string', // 私聊的本地最大 seq_id
        ];
        $params = $this->checkParams($params, $rules);
        $this->logger->info('pullMessageByAppMessageId:' . $appMessageId);
        $authorization = $this->getAuthorization();
        return $this->magicChatMessageAppService->pullByAppMessageId($authorization, $appMessageId, $params['page_token'] ?? '');
    }

    /**
     * 拉取用户的最近一段时间收件消息.
     * @throws Throwable
     */
    public function pullRecentMessage(RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'page_token' => 'string',
        ];
        $params = $this->checkParams($params, $rules);
        $messagesQueryDTO = new MessagesQueryDTO();
        $messagesQueryDTO->setLimit(500);
        $messagesQueryDTO->setOrder(Order::Desc);
        $messagesQueryDTO->setPageToken($params['page_token'] ?? '');
        $authorization = $this->getAuthorization();
        return $this->magicChatMessageAppService->pullRecentMessage($authorization, $messagesQueryDTO);
    }

    /**
     * @throws Throwable
     */
    public function conversationQueries(RequestInterface $request): array
    {
        $authorization = $this->getAuthorization();
        $params = $request->all();
        $rules = [
            'ids' => 'array|nullable',
            'status' => 'int|nullable',
            'limit' => 'int|nullable',
            'page_token' => 'string',
            'is_not_disturb' => 'int|nullable',
            'is_top' => 'int|nullable',
            'is_mark' => 'int|nullable',
        ];
        $params = $this->checkParams($params, $rules);
        $dto = new ConversationListQueryDTO(
            [
                'ids' => $params['ids'] ?? [],
                'limit' => $params['limit'] ?? 100,
                'page_token' => $params['page_token'] ?? '',
                'status' => isset($params['status']) ? (int) $params['status'] : null,
                'is_not_disturb' => isset($params['is_not_disturb']) ? (int) $params['is_not_disturb'] : null,
                'is_top' => isset($params['is_top']) ? (int) $params['is_top'] : null,
                'is_mark' => isset($params['is_mark']) ? (int) $params['is_mark'] : null,
            ]
        );
        return $this->magicChatMessageAppService->getConversations($authorization, $dto)->toArray();
    }

    /**
     * @throws Throwable
     */
    public function getTopicList(string $conversationId, RequestInterface $request): array
    {
        $authorization = $this->getAuthorization();
        $topicIds = (array) $request->input('topic_ids', []);
        return $this->magicChatMessageAppService->getTopicsByConversationId($authorization, $conversationId, $topicIds);
    }

    /**
     * 会话窗口滚动加载消息.
     */
    public function messageQueries(RequestInterface $request, string $conversationId): array
    {
        $params = $request->all();
        $rules = [
            'topic_id' => 'string|nullable',
            'time_start' => 'string|nullable',
            'time_end' => 'string|nullable',
            'page_token' => 'string',
            'limit' => 'int',
            'order' => 'string',
        ];
        $params = $this->checkParams($params, $rules);
        $timeStart = ! empty($params['time_start']) ? new Carbon($params['time_start']) : null;
        $timeEnd = ! empty($params['time_end']) ? new Carbon($params['time_end']) : null;
        $order = ! empty($params['order']) ? Order::from($params['order']) : Order::Asc;
        $conversationMessagesQueryDTO = (new MessagesQueryDTO())
            ->setConversationId($conversationId)
            ->setTopicId($params['topic_id'] ?? '')
            ->setTimeStart($timeStart)
            ->setTimeEnd($timeEnd)
            ->setPageToken($params['page_token'] ?? '')
            ->setLimit($params['limit'] ?? 100)
            ->setOrder($order);
        $authorization = $this->getAuthorization();
        return $this->magicChatMessageAppService->getMessagesByConversationId($authorization, $conversationId, $conversationMessagesQueryDTO);
    }

    /**
     * （前端性能有问题的临时方案）按会话 id 分组获取几条最新消息.
     */
    public function conversationsMessagesGroupQueries(RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'conversation_ids' => 'array|required',
            'limit' => 'int|nullable',
        ];
        $params = $this->checkParams($params, $rules);
        $limit = min($params['limit'] ?? 100, 100);
        $conversationsMessageQueryDTO = (new MessagesQueryDTO())
            ->setConversationIds($params['conversation_ids'])
            ->setLimit($limit)
            ->setOrder(Order::Desc);
        $authorization = $this->getAuthorization();
        return $this->magicChatMessageAppService->getConversationsMessagesGroupById($authorization, $conversationsMessageQueryDTO);
    }

    /**
     * 智能根据话题id获取话题名称.
     */
    public function intelligenceGetTopicName(string $conversationId, string $topicId): array
    {
        $authorization = $this->getAuthorization();
        $topicName = $this->magicChatMessageAppService->intelligenceRenameTopicName($authorization, $topicId, $conversationId);
        return [
            'conversation_id' => $conversationId,
            'id' => $topicId,
            'name' => $topicName,
        ];
    }

    /**
     * 创建聊天群组.
     */
    public function createChatGroup(RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'group_name' => 'string',
            'group_avatar' => 'string',
            'group_type' => ['integer', Rule::in([1, 2])],
            'user_ids' => 'array',
            'department_ids' => 'array',
        ];
        $params = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();
        $magicGroupDTO = new MagicGroupEntity();
        $magicGroupDTO->setGroupAvatar($params['group_avatar']);
        $magicGroupDTO->setGroupName($params['group_name']);
        $magicGroupDTO->setGroupType(GroupTypeEnum::from($params['group_type']));
        $magicGroupDTO->setGroupStatus(GroupStatusEnum::Normal);
        // 人员和部门不能同时为空
        if (empty($params['user_ids']) && empty($params['department_ids'])) {
            ExceptionBuilder::throw(ChatErrorCode::GROUP_USER_SELECT_ERROR);
        }
        return $this->chatGroupAppService->createChatGroup($params['user_ids'], $params['department_ids'], $authorization, $magicGroupDTO);
    }

    /**
     * 批量拉人进群.
     */
    public function groupAddUsers(string $id, RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'user_ids' => 'array',
            'department_ids' => 'array',
        ];
        $params = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();
        $magicGroupDTO = new MagicGroupEntity();
        $magicGroupDTO->setId($id);
        // 人员和部门不能同时为空
        if (empty($params['user_ids']) && empty($params['department_ids'])) {
            ExceptionBuilder::throw(ChatErrorCode::GROUP_USER_SELECT_ERROR);
        }
        return $this->chatGroupAppService->groupAddUsers($params['user_ids'], $params['department_ids'], $authorization, $magicGroupDTO);
    }

    public function leaveGroupConversation(string $id): array
    {
        $authorization = $this->getAuthorization();
        $magicGroupDTO = new MagicGroupEntity();
        $magicGroupDTO->setId($id);
        return $this->chatGroupAppService->leaveGroupConversation(
            $authorization,
            $magicGroupDTO,
            [$authorization->getId()],
            ControlMessageType::GroupUsersRemove
        );
    }

    public function groupKickUsers(string $id, RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'user_ids' => 'required|array',
        ];
        $params = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();
        $magicGroupDTO = new MagicGroupEntity();
        $magicGroupDTO->setId($id);
        return $this->chatGroupAppService->groupKickUsers(
            $authorization,
            $magicGroupDTO,
            $params['user_ids'],
            ControlMessageType::GroupUsersRemove
        );
    }

    /**
     * 解散群聊.
     */
    public function groupDelete(string $id): array
    {
        $authorization = $this->getAuthorization();
        $magicGroupDTO = new MagicGroupEntity();
        $magicGroupDTO->setId($id);
        return $this->chatGroupAppService->deleteGroup($authorization, $magicGroupDTO);
    }

    /**
     * 批量获取群信息（名称、公告等）.
     */
    public function getMagicGroupList(RequestInterface $request): array
    {
        $groupIds = (array) $request->input('group_ids', '');
        $pageToken = (string) $request->input('page_token', '');
        if (empty($groupIds)) {
            $list = [];
        } else {
            $authorization = $this->getAuthorization();
            $list = $this->chatGroupAppService->getGroupsInfo($groupIds, $authorization);
        }
        return PageListAssembler::pageByMysql($list);
    }

    public function GroupUpdateInfo(string $id, RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'group_name' => 'string|nullable',
            'group_avatar' => 'string|nullable',
        ];
        $params = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();
        $magicGroupDTO = new MagicGroupEntity();
        $magicGroupDTO->setId($id);
        $magicGroupDTO->setGroupName($params['group_name'] ?? null);
        $magicGroupDTO->setGroupAvatar($params['group_avatar'] ?? null);
        // name 和 avatar 不能同时为空
        if (empty($magicGroupDTO->getGroupName()) && empty($magicGroupDTO->getGroupAvatar())) {
            ExceptionBuilder::throw(ChatErrorCode::INPUT_PARAM_ERROR);
        }
        return $this->chatGroupAppService->GroupUpdateInfo($authorization, $magicGroupDTO);
    }

    /**
     * 获取群成员列表.
     */
    public function getGroupUserList(string $id, RequestInterface $request): array
    {
        $pageToken = (string) $request->query('page_token', '');
        $authorization = $this->getAuthorization();
        $users = $this->chatGroupAppService->getGroupUserList($id, $pageToken, $authorization);
        return PageListAssembler::pageByMysql($users);
    }

    /**
     * 用户所在群组列表.
     */
    public function getUserGroupList(RequestInterface $request): array
    {
        $pageToken = (string) $request->input('page_token', '');
        $pageSize = 50;
        $authorization = $this->getAuthorization();
        return $this->chatGroupAppService->getUserGroupList($pageToken, $authorization, $pageSize)->toArray();
    }

    public function getMessageReceiveList(string $messageId): array
    {
        $authorization = $this->getAuthorization();
        return $this->magicChatMessageAppService->getMessageReceiveList($messageId, $authorization);
    }

    public function groupTransferOwner(string $id, RequestInterface $request)
    {
        $params = $request->all();
        $rules = [
            'owner_user_id' => 'required|string',
        ];
        $params = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();
        $groupDTO = new MagicGroupEntity();
        $groupDTO->setId($id);
        $groupDTO->setGroupOwner($params['owner_user_id']);
        return $this->chatGroupAppService->groupTransferOwner($groupDTO, $authorization);
    }

    public function fileUpload(RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            '*.file_extension' => 'required|string',
            '*.file_key' => 'required|string',
            '*.file_size' => 'required|int',
            '*.file_name' => 'required|string',
        ];
        $params = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();
        $fileUploadDTOs = [];
        foreach ($params as $file) {
            $fileType = FileType::getTypeFromFileExtension($file['file_extension']);
            $fileUploadDTO = new MagicChatFileEntity();
            $fileUploadDTO->setFileKey($file['file_key']);
            $fileUploadDTO->setFileSize($file['file_size']);
            $fileUploadDTO->setFileExtension($file['file_extension']);
            $fileUploadDTO->setFileName($file['file_name']);
            $fileUploadDTO->setFileType($fileType);
            $fileUploadDTOs[] = $fileUploadDTO;
        }
        return $this->magicChatMessageAppService->fileUpload($fileUploadDTOs, $authorization);
    }

    public function getFileDownUrl(RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            '*.file_id' => 'required|string',
            '*.message_id' => 'required|string',
        ];
        $params = $this->checkParams($params, $rules);
        $authorization = $this->getAuthorization();
        $fileDTOs = [];
        foreach ($params as $param) {
            $fileId = $param['file_id'];
            $messageId = $param['message_id'];
            $fileQueryDTO = new MagicChatFileEntity();
            $fileQueryDTO->setFileId($fileId);
            $fileQueryDTO->setMessageId($messageId);
            $fileDTOs[] = $fileQueryDTO;
        }
        return $this->magicChatMessageAppService->getFileDownUrl($fileDTOs, $authorization);
    }

    /**
     * Chat completion in conversation window.
     */
    public function conversationChatCompletions(string $conversationId, RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'topic_id' => 'string',
            'message' => 'required|string',
            'history' => 'array', // Support external history messages if not in conversation
        ];
        $params = $this->checkParams($params, $rules);

        return $this->handleChatCompletions($params, $conversationId, $params['topic_id'] ?? '');
    }

    /**
     * Chat completion with optional conversation_id and topic_id.
     */
    public function typingCompletions(RequestInterface $request): array
    {
        $params = $request->all();
        $rules = [
            'conversation_id' => 'string',
            'topic_id' => 'string',
            'message' => 'required|string',
            'history' => 'array|nullable', // Support external history messages
        ];
        $params = $this->checkParams($params, $rules);
        $conversationId = $params['conversation_id'] ?? null;
        $topicId = $params['topic_id'] ?? null;
        return $this->handleChatCompletions($params, $conversationId, $topicId);
    }

    /**
     * 会话保存交互指令.
     */
    public function saveInstruct(string $conversationId, RequestInterface $request)
    {
        $instructs = $request->input('instructs');
        $receiveId = $request->input('receive_id');
        $authenticatable = $this->getAuthorization();
        $magicAgentVersionEntity = $this->magicAgentAppService->getDetailByUserId($receiveId);
        if ($magicAgentVersionEntity === null) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.agent_does_not_exist');
        }
        $agentInstruct = $magicAgentVersionEntity->getInstructs();
        $instructResult = $this->magicConversationAppService->saveInstruct($authenticatable, $instructs, $conversationId, $agentInstruct);

        $magicMessageEntity = new MagicMessageEntity();
        $magicMessageEntity->setSenderOrganizationCode($authenticatable->getOrganizationCode());
        $magicMessageEntity->setSenderType(ConversationType::Ai);
        $magicMessageEntity->setMessageType(ControlMessageType::AgentInstruct);
        $magicMessageEntity->setAppMessageId(IdGenerator::getUniqueId32());
        $magicMessageEntity->setSenderId($authenticatable->getId());
        $instructMessage = new InstructMessage();
        $instructMessage->setInstruct($instructResult);
        $magicMessageEntity->setContent($instructMessage);
        $this->magicControlMessageAppService->clientOperateInstructMessage($magicMessageEntity, $conversationId);
        return $instructResult;
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

    /**
     * 处理聊天补全的共同逻辑.
     */
    protected function handleChatCompletions(array $params, ?string $conversationId, ?string $topicId): array
    {
        $authorization = $this->getAuthorization();
        $message = $params['message'];

        try {
            // Generate cache key
            $cacheKey = $this->generateCacheKey($conversationId, $topicId, $message, $authorization->getId());

            // Check if result exists in cache
            $cachedResult = $this->redis->get($cacheKey);
            if ($cachedResult) {
                return ConversationAssembler::getConversationChatCompletions($params, $cachedResult);
            }

            // Create ChatCompletionsDTO
            $chatCompletionsDTO = new ChatCompletionsDTO();
            $chatCompletionsDTO->setConversationId($conversationId);
            $chatCompletionsDTO->setMessage($message);
            $chatCompletionsDTO->setHistory($params['history'] ?? []);
            $chatCompletionsDTO->setTopicId($topicId ?? '');

            // Fetch history messages
            $historyMessages = $this->getHistoryMessages($authorization, $conversationId, $topicId, $params['history'] ?? []);

            // Delegate to app layer for LLM call and fallback, get string content directly
            $completionContent = $this->magicConversationAppService->conversationChatCompletions($historyMessages ?: [], $chatCompletionsDTO, $authorization);

            // Process completion content
            $completionContent = $this->processCompletionContent($completionContent);

            // Cache result if completionContent is not empty
            if (! empty($completionContent)) {
                $this->redis->setex($cacheKey, 5, $completionContent);
            }

            return ConversationAssembler::getConversationChatCompletions($params, $completionContent);
        } catch (Throwable $exception) {
            $this->logger->error(sprintf(
                'message: %s, file: %s, line: %s, trace: %s',
                $exception->getMessage(),
                $exception->getFile(),
                $exception->getLine(),
                $exception->getTraceAsString()
            ));
            // Don't throw error
            return ConversationAssembler::getConversationChatCompletions($params, '');
        }
    }

    /**
     * 生成缓存键.
     */
    private function generateCacheKey(?string $conversationId, ?string $topicId, string $message, string $userId): string
    {
        return 'chat_completion:' . md5($conversationId . $topicId . $message . $userId);
    }

    /**
     * 获取历史消息.
     * @param mixed $authorization
     */
    private function getHistoryMessages($authorization, ?string $conversationId, ?string $topicId, ?array $externalHistory): array
    {
        if (empty($conversationId)) {
            return $externalHistory;
        }

        return $this->magicChatMessageAppService->getConversationChatCompletionsHistory(
            $authorization,
            $conversationId,
            20,
            $topicId ?? ''
        );
    }

    /**
     * 处理补全内容.
     */
    private function processCompletionContent(string $completionContent): string
    {
        // Split content by \n and keep only the left part
        $completionContent = explode("\n", $completionContent, 2)[0];

        // Remove emojis
        $regex = '/[\x{1F300}-\x{1F77F}\x{1F780}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B50}\x{2B55}\x{23E9}-\x{23EF}\x{23F0}\x{23F3}\x{24C2}\x{25AA}\x{25AB}\x{25B6}\x{25C0}\x{25FB}-\x{25FE}\x{00A9}\x{00AE}\x{203C}\x{2049}\x{2122}\x{2139}\x{2194}-\x{2199}\x{21A9}-\x{21AA}\x{231A}-\x{231B}\x{2328}\x{23CF}\x{23F1}-\x{23F2}\x{23F8}-\x{23FA}\x{2934}-\x{2935}\x{2B05}-\x{2B07}\x{2B1B}\x{2B1C}\x{3030}\x{303D}\x{3297}\x{3299}]/u';

        // Remove trailing \n and special characters like spaces
        return rtrim(preg_replace($regex, '', $completionContent));
    }
}
