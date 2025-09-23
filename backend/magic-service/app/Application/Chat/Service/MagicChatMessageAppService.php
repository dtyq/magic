<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Service;

use App\Application\ModelGateway\Mapper\ModelGatewayMapper;
use App\Application\ModelGateway\Service\LLMAppService;
use App\Application\ModelGateway\Service\ModelConfigAppService;
use App\Domain\Chat\DTO\ConversationListQueryDTO;
use App\Domain\Chat\DTO\Message\ChatFileInterface;
use App\Domain\Chat\DTO\Message\ChatMessage\AbstractAttachmentMessage;
use App\Domain\Chat\DTO\Message\ChatMessage\VoiceMessage;
use App\Domain\Chat\DTO\Message\MessageInterface;
use App\Domain\Chat\DTO\Message\StreamMessage\StreamMessageStatus;
use App\Domain\Chat\DTO\Message\StreamMessageInterface;
use App\Domain\Chat\DTO\Message\TextContentInterface;
use App\Domain\Chat\DTO\MessagesQueryDTO;
use App\Domain\Chat\DTO\PageResponseDTO\ConversationsPageResponseDTO;
use App\Domain\Chat\DTO\Request\ChatRequest;
use App\Domain\Chat\DTO\Request\Common\MagicContext;
use App\Domain\Chat\DTO\Response\ClientSequenceResponse;
use App\Domain\Chat\DTO\Stream\CreateStreamSeqDTO;
use App\Domain\Chat\DTO\UserGroupConversationQueryDTO;
use App\Domain\Chat\Entity\Items\SeqExtra;
use App\Domain\Chat\Entity\MagicChatFileEntity;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationStatus;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\FileType;
use App\Domain\Chat\Entity\ValueObject\LLMModelEnum;
use App\Domain\Chat\Entity\ValueObject\MagicMessageStatus;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Chat\Service\MagicChatDomainService;
use App\Domain\Chat\Service\MagicChatFileDomainService;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Chat\Service\MagicSeqDomainService;
use App\Domain\Chat\Service\MagicTopicDomainService;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Service\ModelConfigDomainService;
use App\ErrorCode\ChatErrorCode;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Constants\Order;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Infrastructure\Util\Odin\AgentFactory;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use App\Interfaces\Chat\Assembler\PageListAssembler;
use App\Interfaces\Chat\Assembler\SeqAssembler;
use Carbon\Carbon;
use Hyperf\Codec\Json;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Odin\Memory\MessageHistory;
use Hyperf\Odin\Message\Role;
use Hyperf\Odin\Message\SystemMessage;
use Hyperf\Redis\Redis;
use Hyperf\SocketIOServer\Socket;
use Hyperf\WebSocketServer\Context as WebSocketContext;
use Psr\Log\LoggerInterface;
use Psr\SimpleCache\CacheInterface;
use RuntimeException;
use Throwable;

use function Hyperf\Coroutine\co;

/**
 * 聊天消息相关.
 */
class MagicChatMessageAppService extends MagicSeqAppService
{
    public function __construct(
        protected LoggerInterface $logger,
        protected readonly MagicChatDomainService $magicChatDomainService,
        protected readonly MagicTopicDomainService $magicTopicDomainService,
        protected readonly MagicConversationDomainService $magicConversationDomainService,
        protected readonly MagicChatFileDomainService $magicChatFileDomainService,
        protected MagicSeqDomainService $magicSeqDomainService,
        protected FileDomainService $fileDomainService,
        protected CacheInterface $cache,
        protected MagicUserDomainService $magicUserDomainService,
        protected Redis $redis,
        protected LockerInterface $locker,
        protected readonly LLMAppService $llmAppService,
        protected readonly ModelConfigDomainService $modelConfigDomainService,
        protected readonly MagicMessageVersionDomainService $magicMessageVersionDomainService,
    ) {
        try {
            $this->logger = ApplicationContext::getContainer()->get(LoggerFactory::class)?->get(get_class($this));
        } catch (Throwable) {
        }
        parent::__construct($magicSeqDomainService);
    }

    public function joinRoom(MagicUserAuthorization $userAuthorization, Socket $socket): void
    {
        // 将所有 sid 都加入到房间 id 值为 magicId 的房间中
        $this->magicChatDomainService->joinRoom($userAuthorization->getMagicId(), $socket);
    }

    /**
     * 返回最大消息的倒数 n 条序列.
     * @return ClientSequenceResponse[]
     * @deprecated
     */
    public function pullMessage(MagicUserAuthorization $userAuthorization, array $params): array
    {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        return $this->magicChatDomainService->pullMessage($dataIsolation, $params);
    }

    /**
     * 返回最大消息的倒数 n 条序列.
     * @return ClientSequenceResponse[]
     */
    public function pullByPageToken(MagicUserAuthorization $userAuthorization, array $params): array
    {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $pageSize = 200;
        return $this->magicChatDomainService->pullByPageToken($dataIsolation, $params, $pageSize);
    }

    /**
     * 返回最大消息的倒数 n 条序列.
     * @return ClientSequenceResponse[]
     */
    public function pullByAppMessageId(MagicUserAuthorization $userAuthorization, string $appMessageId, string $pageToken): array
    {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $pageSize = 200;
        return $this->magicChatDomainService->pullByAppMessageId($dataIsolation, $appMessageId, $pageToken, $pageSize);
    }

    public function pullRecentMessage(MagicUserAuthorization $userAuthorization, MessagesQueryDTO $messagesQueryDTO): array
    {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        return $this->magicChatDomainService->pullRecentMessage($dataIsolation, $messagesQueryDTO);
    }

    public function getConversations(MagicUserAuthorization $userAuthorization, ConversationListQueryDTO $queryDTO): ConversationsPageResponseDTO
    {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $result = $this->magicConversationDomainService->getConversations($dataIsolation, $queryDTO);
        $filterAccountEntity = $this->magicUserDomainService->getByAiCode($dataIsolation, 'SUPER_MAGIC');
        if (! empty($filterAccountEntity) && count($result->getItems()) > 0) {
            $filterItems = [];
            foreach ($result->getItems() as $item) {
                /**
                 * @var MagicConversationEntity $item
                 */
                if ($item->getReceiveId() !== $filterAccountEntity->getUserId()) {
                    $filterItems[] = $item;
                }
            }
            $result->setItems($filterItems);
        }
        return $result;
    }

    public function getUserGroupConversation(UserGroupConversationQueryDTO $queryDTO): ?MagicConversationEntity
    {
        $conversationEntity = MagicConversationEntity::fromUserGroupConversationQueryDTO($queryDTO);
        return $this->magicConversationDomainService->getConversationByUserIdAndReceiveId($conversationEntity);
    }

    /**
     * @throws Throwable
     */
    public function onChatMessage(ChatRequest $chatRequest, MagicUserAuthorization $userAuthorization): array
    {
        $conversationEntity = $this->magicChatDomainService->getConversationById($chatRequest->getData()->getConversationId());
        if ($conversationEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
        $seqDTO = new MagicSeqEntity();
        $seqDTO->setReferMessageId($chatRequest->getData()->getReferMessageId());
        $topicId = $chatRequest->getData()->getMessage()->getTopicId();
        $seqExtra = new SeqExtra();
        $seqExtra->setMagicEnvId($userAuthorization->getMagicEnvId());
        // 是否是编辑消息
        $editMessageOptions = $chatRequest->getData()->getEditMessageOptions();
        if ($editMessageOptions !== null) {
            $seqExtra->setEditMessageOptions($editMessageOptions);
        }
        // seq 的扩展信息. 如果需要检索话题的消息,请查询 topic_messages 表
        $topicId && $seqExtra->setTopicId($topicId);
        $seqDTO->setExtra($seqExtra);
        // 如果是跟助理的私聊，且没有话题 id，自动创建一个话题
        if ($conversationEntity->getReceiveType() === ConversationType::Ai && empty($seqDTO->getExtra()?->getTopicId())) {
            $topicId = $this->magicTopicDomainService->agentSendMessageGetTopicId($conversationEntity, 0);
            // 不影响原有逻辑，将 topicId 设置到 extra 中
            $seqExtra = $seqDTO->getExtra() ?? new SeqExtra();
            $seqExtra->setTopicId($topicId);
            $seqDTO->setExtra($seqExtra);
        }
        $senderUserEntity = $this->magicChatDomainService->getUserInfo($conversationEntity->getUserId());
        $messageDTO = MessageAssembler::getChatMessageDTOByRequest(
            $chatRequest,
            $conversationEntity,
            $senderUserEntity
        );
        return $this->dispatchClientChatMessage($seqDTO, $messageDTO, $userAuthorization, $conversationEntity);
    }

    /**
     * 消息鉴权.
     * @throws Throwable
     */
    public function checkSendMessageAuth(MagicSeqEntity $senderSeqDTO, MagicMessageEntity $senderMessageDTO, MagicConversationEntity $conversationEntity, DataIsolation $dataIsolation): void
    {
        // 检查会话 id所属组织，与当前传入组织编码的一致性
        if ($conversationEntity->getUserOrganizationCode() !== $dataIsolation->getCurrentOrganizationCode()) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
        // 判断会话的发起者是否是当前用户,并且不是助理
        if ($conversationEntity->getReceiveType() !== ConversationType::Ai && $conversationEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
        }
        // 会话是否已被删除
        if ($conversationEntity->getStatus() === ConversationStatus::Delete) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_DELETED);
        }
        // 如果是编辑消息，检查被编辑消息的合法性(自己发的消息，且在当前会话中)
        $this->checkEditMessageLegality($senderSeqDTO, $dataIsolation);
        return;
        // todo 如果消息中有文件:1.判断文件的所有者是否是当前用户;2.判断用户是否接收过这些文件。
        /* @phpstan-ignore-next-line */
        $messageContent = $senderMessageDTO->getContent();
        if ($messageContent instanceof ChatFileInterface) {
            $fileIds = $messageContent->getFileIds();
            if (! empty($fileIds)) {
                // 批量查询文件所有权，而不是循环查询
                $fileEntities = $this->magicChatFileDomainService->getFileEntitiesByFileIds($fileIds);

                // 检查是否所有文件都存在
                $existingFileIds = array_map(static function (MagicChatFileEntity $fileEntity) {
                    return $fileEntity->getFileId();
                }, $fileEntities);

                // 检查是否有请求的文件 ID 不在已查询到的文件 ID 中
                $missingFileIds = array_diff($fileIds, $existingFileIds);
                if (! empty($missingFileIds)) {
                    ExceptionBuilder::throw(ChatErrorCode::FILE_NOT_FOUND);
                }

                // 检查文件所有者是否是当前用户
                foreach ($fileEntities as $fileEntity) {
                    if ($fileEntity->getUserId() !== $dataIsolation->getCurrentUserId()) {
                        ExceptionBuilder::throw(ChatErrorCode::FILE_NOT_FOUND);
                    }
                }
            }
        }

        // todo 检查是否有发消息的权限(需要有好友关系，企业关系，集团关系，合作伙伴关系等)
    }

    /**
     * 助理给人类或者群发消息,支持在线消息和离线消息(取决于用户是否在线).
     * @param MagicSeqEntity $aiSeqDTO 怎么传参可以参考 api层的 aiSendMessage 方法
     * @param string $appMessageId 消息防重,客户端(包括flow)自己对消息生成一条编码
     * @param bool $doNotParseReferMessageId 不由 chat 判断 referMessageId 的引用时机,由调用方自己判断
     * @throws Throwable
     */
    public function aiSendMessage(
        MagicSeqEntity $aiSeqDTO,
        string $appMessageId = '',
        ?Carbon $sendTime = null,
        bool $doNotParseReferMessageId = false
    ): array {
        try {
            if ($sendTime === null) {
                $sendTime = new Carbon();
            }
            // 如果用户给助理发送了多条消息,助理回复时,需要让用户知晓助理回复的是他的哪条消息.
            $aiSeqDTO = $this->magicChatDomainService->aiReferMessage($aiSeqDTO, $doNotParseReferMessageId);
            // 获取助理的会话窗口
            $aiConversationEntity = $this->magicChatDomainService->getConversationById($aiSeqDTO->getConversationId());
            if ($aiConversationEntity === null) {
                ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
            }
            // 确认发件人是否是助理
            $aiUserId = $aiConversationEntity->getUserId();
            $aiUserEntity = $this->magicChatDomainService->getUserInfo($aiUserId);
            if ($aiUserEntity->getUserType() !== UserType::Ai) {
                ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
            }
            // 如果是助理与人私聊，且助理发送的消息没有话题 id，则报错
            if ($aiConversationEntity->getReceiveType() === ConversationType::User && empty($aiSeqDTO->getExtra()?->getTopicId())) {
                ExceptionBuilder::throw(ChatErrorCode::TOPIC_ID_NOT_FOUND);
            }
            // 助理准备开始发消息了,结束输入状态
            $contentStruct = $aiSeqDTO->getContent();
            $isStream = $contentStruct instanceof StreamMessageInterface && $contentStruct->isStream();
            $beginStreamMessage = $isStream && $contentStruct instanceof StreamMessageInterface && $contentStruct->getStreamOptions()?->getStatus() === StreamMessageStatus::Start;
            if (! $isStream || $beginStreamMessage) {
                // 非流式响应或者流式响应开始输入
                $this->magicConversationDomainService->agentOperateConversationStatusV2(
                    ControlMessageType::EndConversationInput,
                    $aiConversationEntity->getId(),
                    $aiSeqDTO->getExtra()?->getTopicId()
                );
            }
            // 创建userAuth
            $userAuthorization = $this->getAgentAuth($aiUserEntity);
            // 创建消息
            $messageDTO = $this->createAgentMessageDTO($aiSeqDTO, $aiUserEntity, $aiConversationEntity, $appMessageId, $sendTime);
            return $this->dispatchClientChatMessage($aiSeqDTO, $messageDTO, $userAuthorization, $aiConversationEntity);
        } catch (Throwable $exception) {
            $this->logger->error(Json::encode([
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'message' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ]));
            throw $exception;
        }
    }

    /**
     * 助理给人类或者群发消息,可以不传会话和话题 id,自动创建会话，非群组会话自动适配话题 id.
     * @param string $appMessageId 消息防重,客户端(包括flow)自己对消息生成一条编码
     * @param bool $doNotParseReferMessageId 可以不由 chat 判断 referMessageId 的引用时机,由调用方自己判断
     * @throws Throwable
     */
    public function agentSendMessage(
        MagicSeqEntity $aiSeqDTO,
        string $senderUserId,
        string $receiverId,
        string $appMessageId = '',
        bool $doNotParseReferMessageId = false,// 可以不由 chat 判断 referMessageId 的引用时机,由调用方自己判断
        ?Carbon $sendTime = null,
        ?ConversationType $receiverType = null
    ): array {
        // 1.判断 $senderUserId 与 $receiverUserId的会话是否存在（参考getOrCreateConversation方法）
        $senderConversationEntity = $this->magicConversationDomainService->getOrCreateConversation($senderUserId, $receiverId, $receiverType);
        // 还要创建接收方的会话窗口，要不然无法创建话题
        $this->magicConversationDomainService->getOrCreateConversation($receiverId, $senderUserId);

        // 2.如果 $seqExtra 不为 null，校验是否有 topic id，如果没有，参考 agentSendMessageGetTopicId 方法，得到话题 id
        $topicId = $aiSeqDTO->getExtra()?->getTopicId() ?? '';
        if (empty($topicId) && $receiverType !== ConversationType::Group) {
            $topicId = $this->magicTopicDomainService->agentSendMessageGetTopicId($senderConversationEntity, 0);
        }
        // 3.组装参数，调用 aiSendMessage 方法
        $aiSeqDTO->getExtra() === null && $aiSeqDTO->setExtra(new SeqExtra());
        $aiSeqDTO->getExtra()->setTopicId($topicId);
        $aiSeqDTO->setConversationId($senderConversationEntity->getId());
        return $this->aiSendMessage($aiSeqDTO, $appMessageId, $sendTime, $doNotParseReferMessageId);
    }

    /**
     * 人类给助理或者群发消息,可以不传会话和话题 id,自动创建会话，非群组会话自动适配话题 id.
     * @param string $appMessageId 消息防重,客户端(包括flow)自己对消息生成一条编码
     * @param bool $doNotParseReferMessageId 可以不由 chat 判断 referMessageId 的引用时机,由调用方自己判断
     * @throws Throwable
     */
    public function userSendMessageToAgent(
        MagicSeqEntity $aiSeqDTO,
        string $senderUserId,
        string $receiverId,
        string $appMessageId = '',
        bool $doNotParseReferMessageId = false,// 可以不由 chat 判断 referMessageId 的引用时机,由调用方自己判断
        ?Carbon $sendTime = null,
        ?ConversationType $receiverType = null,
        string $topicId = ''
    ): array {
        // 1.判断 $senderUserId 与 $receiverUserId的会话是否存在（参考getOrCreateConversation方法）
        $senderConversationEntity = $this->magicConversationDomainService->getOrCreateConversation($senderUserId, $receiverId, $receiverType);
        // 如果接收方非群组，则创建 senderUserId 与 receiverUserId 的会话.
        if ($receiverType !== ConversationType::Group) {
            $this->magicConversationDomainService->getOrCreateConversation($receiverId, $senderUserId);
        }
        // 2.如果 $seqExtra 不为 null，校验是否有 topic id，如果没有，参考 agentSendMessageGetTopicId 方法，得到话题 id
        if (empty($topicId)) {
            $topicId = $aiSeqDTO->getExtra()?->getTopicId() ?? '';
        }

        if (empty($topicId) && $receiverType !== ConversationType::Group) {
            $topicId = $this->magicTopicDomainService->agentSendMessageGetTopicId($senderConversationEntity, 0);
        }

        // 如果是群组，则不需要获取话题 id
        if ($receiverType === ConversationType::Group) {
            $topicId = '';
        }

        // 3.组装参数，调用 sendMessageToAgent 方法
        $aiSeqDTO->getExtra() === null && $aiSeqDTO->setExtra(new SeqExtra());
        $aiSeqDTO->getExtra()->setTopicId($topicId);
        $aiSeqDTO->setConversationId($senderConversationEntity->getId());
        return $this->sendMessageToAgent($aiSeqDTO, $appMessageId, $sendTime, $doNotParseReferMessageId);
    }

    /**
     * 助理给人类或者群发消息,支持在线消息和离线消息(取决于用户是否在线).
     * @param MagicSeqEntity $aiSeqDTO 怎么传参可以参考 api层的 aiSendMessage 方法
     * @param string $appMessageId 消息防重,客户端(包括flow)自己对消息生成一条编码
     * @param bool $doNotParseReferMessageId 不由 chat 判断 referMessageId 的引用时机,由调用方自己判断
     * @throws Throwable
     */
    public function sendMessageToAgent(
        MagicSeqEntity $aiSeqDTO,
        string $appMessageId = '',
        ?Carbon $sendTime = null,
        bool $doNotParseReferMessageId = false
    ): array {
        try {
            if ($sendTime === null) {
                $sendTime = new Carbon();
            }
            // 如果用户给助理发送了多条消息,助理回复时,需要让用户知晓助理回复的是他的哪条消息.
            $aiSeqDTO = $this->magicChatDomainService->aiReferMessage($aiSeqDTO, $doNotParseReferMessageId);
            // 获取助理的会话窗口
            $aiConversationEntity = $this->magicChatDomainService->getConversationById($aiSeqDTO->getConversationId());
            if ($aiConversationEntity === null) {
                ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
            }
            // 确认发件人是否是助理
            $aiUserId = $aiConversationEntity->getUserId();
            $aiUserEntity = $this->magicChatDomainService->getUserInfo($aiUserId);
            // if ($aiUserEntity->getUserType() !== UserType::Ai) {
            //     ExceptionBuilder::throw(UserErrorCode::USER_NOT_EXIST);
            // }
            // 如果是助理与人私聊，且助理发送的消息没有话题 id，则报错
            if ($aiConversationEntity->getReceiveType() === ConversationType::User && empty($aiSeqDTO->getExtra()?->getTopicId())) {
                ExceptionBuilder::throw(ChatErrorCode::TOPIC_ID_NOT_FOUND);
            }
            // 助理准备开始发消息了,结束输入状态
            $contentStruct = $aiSeqDTO->getContent();
            $isStream = $contentStruct instanceof StreamMessageInterface && $contentStruct->isStream();
            $beginStreamMessage = $isStream && $contentStruct instanceof StreamMessageInterface && $contentStruct->getStreamOptions()?->getStatus() === StreamMessageStatus::Start;
            if (! $isStream || $beginStreamMessage) {
                // 非流式响应或者流式响应开始输入
                $this->magicConversationDomainService->agentOperateConversationStatusv2(
                    ControlMessageType::EndConversationInput,
                    $aiConversationEntity->getId(),
                    $aiSeqDTO->getExtra()?->getTopicId()
                );
            }
            // 创建userAuth
            $userAuthorization = $this->getAgentAuth($aiUserEntity);
            // 创建消息
            $messageDTO = $this->createAgentMessageDTO($aiSeqDTO, $aiUserEntity, $aiConversationEntity, $appMessageId, $sendTime);
            return $this->dispatchClientChatMessage($aiSeqDTO, $messageDTO, $userAuthorization, $aiConversationEntity);
        } catch (Throwable $exception) {
            $this->logger->error(Json::encode([
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'message' => $exception->getMessage(),
                'trace' => $exception->getTraceAsString(),
            ]));
            throw $exception;
        }
    }

    /**
     * 分发异步消息队列中的seq.
     * 比如根据发件方的seq,为收件方生成seq,投递seq.
     * @throws Throwable
     */
    public function asyncHandlerChatMessage(MagicSeqEntity $senderSeqEntity): void
    {
        Db::beginTransaction();
        try {
            # 以下是聊天消息. 采取写扩散:如果是群,则为群成员的每个人生成seq
            // 1.获取会话信息
            $senderConversationEntity = $this->magicChatDomainService->getConversationById($senderSeqEntity->getConversationId());
            if ($senderConversationEntity === null) {
                $this->logger->error(sprintf('messageDispatchError conversation not found:%s', Json::encode($senderSeqEntity)));
                return;
            }
            $receiveConversationType = $senderConversationEntity->getReceiveType();
            $senderMessageEntity = $this->magicChatDomainService->getMessageByMagicMessageId($senderSeqEntity->getMagicMessageId());
            if ($senderMessageEntity === null) {
                $this->logger->error(sprintf('messageDispatchError senderMessageEntity not found:%s', Json::encode($senderSeqEntity)));
                return;
            }
            $magicSeqStatus = MagicMessageStatus::Unread;
            // 根据会话类型,生成seq
            switch ($receiveConversationType) {
                case ConversationType::Group:
                    $seqListCreateDTO = $this->magicChatDomainService->generateGroupReceiveSequence($senderSeqEntity, $senderMessageEntity, $magicSeqStatus);
                    // todo 群里面的话题消息也写入 topic_messages 表中
                    // 将这些 seq_id 合并为一条 mq 消息进行推送/消费
                    $seqIds = array_keys($seqListCreateDTO);
                    $messagePriority = $this->magicChatDomainService->getChatMessagePriority(ConversationType::Group, count($seqIds));
                    ! empty($seqIds) && $this->magicChatDomainService->batchPushSeq($seqIds, $messagePriority);
                    break;
                case ConversationType::System:
                    throw new RuntimeException('To be implemented');
                case ConversationType::CloudDocument:
                    throw new RuntimeException('To be implemented');
                case ConversationType::MultidimensionalTable:
                    throw new RuntimeException('To be implemented');
                case ConversationType::Topic:
                    throw new RuntimeException('To be implemented');
                case ConversationType::App:
                    throw new RuntimeException('To be implemented');
            }
            Db::commit();
        } catch (Throwable$exception) {
            Db::rollBack();
            throw $exception;
        }
    }

    public function getTopicsByConversationId(MagicUserAuthorization $userAuthorization, string $conversationId, array $topicIds): array
    {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        return $this->magicChatDomainService->getTopicsByConversationId($dataIsolation, $conversationId, $topicIds);
    }

    /**
     * 会话窗口滚动加载消息.
     */
    public function getMessagesByConversationId(MagicUserAuthorization $userAuthorization, string $conversationId, MessagesQueryDTO $conversationMessagesQueryDTO): array
    {
        // 会话所有权校验
        $this->checkConversationsOwnership($userAuthorization, [$conversationId]);

        // 按时间范围，获取会话/话题的消息
        $clientSeqList = $this->magicChatDomainService->getConversationChatMessages($conversationId, $conversationMessagesQueryDTO);
        return $this->formatConversationMessagesReturn($clientSeqList, $conversationMessagesQueryDTO);
    }

    /**
     * @deprecated
     */
    public function getMessageByConversationIds(MagicUserAuthorization $userAuthorization, MessagesQueryDTO $conversationMessagesQueryDTO): array
    {
        // 会话所有权校验
        $conversationIds = $conversationMessagesQueryDTO->getConversationIds();
        if (! empty($conversationIds)) {
            $this->checkConversationsOwnership($userAuthorization, $conversationIds);
        }

        // 获取会话的消息（注意，功能目的与getMessagesByConversationId不同）
        $clientSeqList = $this->magicChatDomainService->getConversationsChatMessages($conversationMessagesQueryDTO);
        return $this->formatConversationMessagesReturn($clientSeqList, $conversationMessagesQueryDTO);
    }

    // 按会话 id 分组获取几条最新消息
    public function getConversationsMessagesGroupById(MagicUserAuthorization $userAuthorization, MessagesQueryDTO $conversationMessagesQueryDTO): array
    {
        // 会话所有权校验
        $conversationIds = $conversationMessagesQueryDTO->getConversationIds();
        if (! empty($conversationIds)) {
            $this->checkConversationsOwnership($userAuthorization, $conversationIds);
        }

        $clientSeqList = $this->magicChatDomainService->getConversationsMessagesGroupById($conversationMessagesQueryDTO);
        // 按会话 id 分组，返回
        $conversationMessages = [];
        foreach ($clientSeqList as $clientSeq) {
            $conversationId = $clientSeq->getSeq()->getConversationId();
            $conversationMessages[$conversationId][] = $clientSeq->toArray();
        }
        return $conversationMessages;
    }

    public function intelligenceRenameTopicName(MagicUserAuthorization $authorization, string $topicId, string $conversationId): string
    {
        $history = $this->getConversationChatCompletionsHistory($authorization, $conversationId, 30, $topicId);
        if (empty($history)) {
            return '';
        }

        $historyContext = MessageAssembler::buildHistoryContext($history, 10000, $authorization->getNickname());
        return $this->summarizeText($authorization, $historyContext);
    }

    /**
     * 使用大模型对文本进行总结.
     */
    public function summarizeText(MagicUserAuthorization $authorization, string $textContent, string $language = 'zh_CN'): string
    {
        if (empty($textContent)) {
            return '';
        }
        $prompt = <<<'PROMPT'
        你是一个专业的内容标题生成助手。请严格按照以下要求为对话内容生成标题：

        ## 任务目标
        根据对话内容，生成一个简洁、准确的标题，能够概括对话的核心主题。

        ## 主题优先级原则
        当对话涉及多个不同主题时：
        1. 优先关注对话中最后讨论的主题（最新的话题）
        2. 以最近的对话内容为主要参考依据
        3. 如果最后的主题讨论较为充分，则以此作为标题的核心
        4. 忽略早期已经结束的话题，除非它们与最新话题密切相关

        ## 严格要求
        1. 标题长度：不超过 15 个字符。英文一个字母算一个字符，汉字一个字算一个字符，其他语种采用类似计数方案。
        2. 内容相关：标题必须直接反映对话的核心主题
        3. 语言风格：使用陈述性语句，避免疑问句
        4. 输出格式：只输出标题内容，不要添加任何解释、标点或其他文字
        5. 禁止行为：不要回答对话中的问题，不要进行额外解释

        ## 对话内容
        <CONVERSATION_START>
        {textContent}
        <CONVERSATION_END>

        ## 输出语言
        <LANGUAGE_START>
        请使用{language}语言输出内容
        <LANGUAGE_END>

        ## 输出
        请直接输出标题：
        PROMPT;

        $prompt = str_replace(['{language}', '{textContent}'], [$language, $textContent], $prompt);

        $conversationId = uniqid('', true);
        $messageHistory = new MessageHistory();
        $messageHistory->addMessages(new SystemMessage($prompt), $conversationId);
        return $this->getSummaryFromLLM($authorization, $messageHistory, $conversationId);
    }

    public function getMessageReceiveList(string $messageId, MagicUserAuthorization $userAuthorization): array
    {
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        return $this->magicChatDomainService->getMessageReceiveList($messageId, $dataIsolation);
    }

    /**
     * @param MagicChatFileEntity[] $fileUploadDTOs
     */
    public function fileUpload(array $fileUploadDTOs, MagicUserAuthorization $authorization): array
    {
        $dataIsolation = $this->createDataIsolation($authorization);
        return $this->magicChatFileDomainService->fileUpload($fileUploadDTOs, $dataIsolation);
    }

    /**
     * @param MagicChatFileEntity[] $fileDTOs
     * @return array<string,array>
     */
    public function getFileDownUrl(array $fileDTOs, MagicUserAuthorization $authorization): array
    {
        $dataIsolation = $this->createDataIsolation($authorization);
        // 权限校验，判断用户的消息中，是否包含本次他想下载的文件
        $fileEntities = $this->magicChatFileDomainService->checkAndGetFilePaths($fileDTOs, $dataIsolation);
        // 下载时还原文件原本的名称
        $downloadNames = [];
        $fileDownloadUrls = [];
        $filePaths = [];
        foreach ($fileEntities as $fileEntity) {
            // 过滤掉有外链，但是没 file_key
            if (! empty($fileEntity->getExternalUrl()) && empty($fileEntity->getFileKey())) {
                $fileDownloadUrls[$fileEntity->getFileId()] = ['url' => $fileEntity->getExternalUrl()];
            } else {
                $downloadNames[$fileEntity->getFileKey()] = $fileEntity->getFileName();
            }
            if (! empty($fileEntity->getFileKey())) {
                $filePaths[$fileEntity->getFileId()] = $fileEntity->getFileKey();
            }
        }
        $fileKeys = array_values(array_unique(array_values($filePaths)));
        $links = $this->fileDomainService->getLinks($authorization->getOrganizationCode(), $fileKeys, null, $downloadNames);
        foreach ($filePaths as $fileId => $fileKey) {
            $fileLink = $links[$fileKey] ?? null;
            if (! $fileLink) {
                continue;
            }
            $fileDownloadUrls[$fileId] = $fileLink->toArray();
        }
        return $fileDownloadUrls;
    }

    /**
     * 给发件方生成消息和Seq.为了保证系统稳定性,给收件方生成消息和Seq的步骤放在mq异步去做.
     * !!! 注意,事务中投递 mq,可能事务还没提交,mq消息就已被消费.
     * @throws Throwable
     */
    public function magicChat(
        MagicSeqEntity $senderSeqDTO,
        MagicMessageEntity $senderMessageDTO,
        MagicConversationEntity $senderConversationEntity
    ): array {
        // 给发件方生成消息和Seq
        // 从messageStruct中解析出来会话窗口详情
        $receiveType = $senderConversationEntity->getReceiveType();
        if (! in_array($receiveType, [ConversationType::Ai, ConversationType::User, ConversationType::Group], true)) {
            ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_TYPE_ERROR);
        }

        $language = di(TranslatorInterface::class)->getLocale();
        // 审计需求：如果是编辑消息，写入消息版本表，并更新原消息的version_id
        $extra = $senderSeqDTO->getExtra();
        // 设置语言信息
        $editMessageOptions = $extra?->getEditMessageOptions();
        if ($extra !== null && $editMessageOptions !== null && ! empty($editMessageOptions->getMagicMessageId())) {
            $senderMessageDTO->setMagicMessageId($editMessageOptions->getMagicMessageId());
            $messageVersionEntity = $this->magicChatDomainService->editMessage($senderMessageDTO);
            $editMessageOptions->setMessageVersionId($messageVersionEntity->getVersionId());
            $senderSeqDTO->setExtra($extra->setEditMessageOptions($editMessageOptions));
            // 再查一次 $messageEntity ，避免重复创建
            $messageEntity = $this->magicChatDomainService->getMessageByMagicMessageId($senderMessageDTO->getMagicMessageId());
            $messageEntity && $messageEntity->setLanguage($language);
        }

        // 如果引用的消息被编辑过，那么修改 referMessageId 为原始的消息 id
        $this->checkAndUpdateReferMessageId($senderSeqDTO);

        $senderMessageDTO->setLanguage($language);

        $messageStruct = $senderMessageDTO->getContent();
        if ($messageStruct instanceof StreamMessageInterface && $messageStruct->isStream()) {
            // 流式消息的场景
            if ($messageStruct->getStreamOptions()->getStatus() === StreamMessageStatus::Start) {
                // 如果是开始，调用 createAndSendStreamStartSequence 方法
                $senderSeqEntity = $this->magicChatDomainService->createAndSendStreamStartSequence(
                    (new CreateStreamSeqDTO())->setTopicId($extra->getTopicId())->setAppMessageId($senderMessageDTO->getAppMessageId()),
                    $messageStruct,
                    $senderConversationEntity
                );
                $senderMessageId = $senderSeqEntity->getMessageId();
                $magicMessageId = $senderSeqEntity->getMagicMessageId();
            } else {
                $streamCachedDTO = $this->magicChatDomainService->streamSendJsonMessage(
                    $senderMessageDTO->getAppMessageId(),
                    $senderMessageDTO->getContent()->toArray(true),
                    $messageStruct->getStreamOptions()->getStatus()
                );
                $senderMessageId = $streamCachedDTO->getSenderMessageId();
                $magicMessageId = $streamCachedDTO->getMagicMessageId();
            }
            // 只在确定 $senderSeqEntity 和 $messageEntity，用于返回数据结构
            $senderSeqEntity = $this->magicSeqDomainService->getSeqEntityByMessageId($senderMessageId);
            $messageEntity = $this->magicChatDomainService->getMessageByMagicMessageId($magicMessageId);
            // 将消息流返回给当前客户端! 但是还是会异步推送给用户的所有在线客户端.
            return SeqAssembler::getClientSeqStruct($senderSeqEntity, $messageEntity)->toArray();
        }

        # 非流式消息
        try {
            Db::beginTransaction();
            if (! isset($messageEntity)) {
                $messageEntity = $this->magicChatDomainService->createMagicMessageByAppClient($senderMessageDTO, $senderConversationEntity);
            }
            // 给自己的消息流生成序列,并确定消息的接收人列表
            $senderSeqEntity = $this->magicChatDomainService->generateSenderSequenceByChatMessage($senderSeqDTO, $messageEntity, $senderConversationEntity);
            // 避免 seq 表承载太多功能,加太多索引,因此将话题的消息单独写入到 topic_messages 表中
            $this->magicChatDomainService->createTopicMessage($senderSeqEntity);
            // 确定消息优先级
            $receiveList = $senderSeqEntity->getReceiveList();
            if ($receiveList === null) {
                $receiveUserCount = 0;
            } else {
                $receiveUserCount = count($receiveList->getUnreadList());
            }
            $senderChatSeqCreatedEvent = $this->magicChatDomainService->getChatSeqCreatedEvent(
                $messageEntity->getReceiveType(),
                $senderSeqEntity,
                $receiveUserCount,
            );
            $conversationType = $senderConversationEntity->getReceiveType();
            if (in_array($conversationType, [ConversationType::Ai, ConversationType::User], true)) {
                // 为了保证收发双方的消息顺序一致性，如果是私聊，则同步生成 seq
                $receiveSeqEntity = $this->syncHandlerSingleChatMessage($senderSeqEntity, $messageEntity);
            } elseif ($conversationType === ConversationType::Group) {
                // 群聊等场景异步给收件方生成Seq并推送给收件方
                $this->magicChatDomainService->dispatchSeq($senderChatSeqCreatedEvent);
            } else {
                ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_TYPE_ERROR);
            }
            Db::commit();
        } catch (Throwable $exception) {
            Db::rollBack();
            throw $exception;
        }
        // 使用 mq 推送消息给收件方
        isset($receiveSeqEntity) && $this->pushReceiveChatSequence($messageEntity, $receiveSeqEntity);
        // 异步推送消息给自己的其他设备
        if ($messageEntity->getSenderType() !== ConversationType::Ai) {
            co(function () use ($senderChatSeqCreatedEvent) {
                $this->magicChatDomainService->pushChatSequence($senderChatSeqCreatedEvent);
            });
        }

        // 如果是编辑消息，且是用户编辑了助理发来的审批表单时，返回空数组。
        // 因为此时创建的 seq_id 是助理的，不是用户的，返回会造成困扰。
        // 经由 mq 分发消息后，用户会异步收到属于他自己的消息推送。
        if (isset($editMessageOptions) && ! empty($editMessageOptions->getMagicMessageId())
            && $messageEntity->getSenderId() !== $senderMessageDTO->getSenderId()) {
            return [];
        }

        // 将消息流返回给当前客户端! 但是还是会异步推送给用户的所有在线客户端.
        return SeqAssembler::getClientSeqStruct($senderSeqEntity, $messageEntity)->toArray();
    }

    /**
     * 如果引用的消息被编辑过，那么修改 referMessageId 为原始的消息 id.
     */
    public function checkAndUpdateReferMessageId(MagicSeqEntity $senderSeqDTO): void
    {
        // 获取引用消息的ID
        $referMessageId = $senderSeqDTO->getReferMessageId();
        if (empty($referMessageId)) {
            return;
        }

        // 查询被引用的消息
        $magicSeqEntity = $this->magicSeqDomainService->getSeqEntityByMessageId($referMessageId);
        if ($magicSeqEntity === null || empty($magicSeqEntity->getMagicMessageId())) {
            ExceptionBuilder::throw(ChatErrorCode::REFER_MESSAGE_NOT_FOUND);
        }

        if (empty($magicSeqEntity->getExtra()?->getEditMessageOptions()?->getMagicMessageId())) {
            return;
        }
        // get message min seqEntity
        $magicSeqEntity = $this->magicSeqDomainService->getSelfMinSeqIdByMagicMessageId($magicSeqEntity);
        if ($magicSeqEntity === null) {
            ExceptionBuilder::throw(ChatErrorCode::REFER_MESSAGE_NOT_FOUND);
        }
        // 便于前端渲染，更新引用消息ID为原始消息ID
        $senderSeqDTO->setReferMessageId($magicSeqEntity->getMessageId());
    }

    /**
     * 开发阶段,前端对接有时间差,上下文兼容性处理.
     */
    public function setUserContext(string $userToken, ?MagicContext $magicContext): void
    {
        if (! $magicContext) {
            ExceptionBuilder::throw(ChatErrorCode::CONTEXT_LOST);
        }
        // 为了支持一个ws链接收发多个账号的消息,允许在消息上下文中传入账号 token
        if (! $magicContext->getAuthorization()) {
            $magicContext->setAuthorization($userToken);
        }
        // 协程上下文中设置用户信息,供 WebsocketChatUserGuard 使用
        WebSocketContext::set(MagicContext::class, $magicContext);
    }

    /**
     * 聊天窗口打字时补全用户输入。为了适配群聊，这里的 role 其实是用户的昵称，而不是角色类型。
     */
    public function getConversationChatCompletionsHistory(
        MagicUserAuthorization $userAuthorization,
        string $conversationId,
        int $limit,
        string $topicId,
        bool $useNicknameAsRole = true
    ): array {
        $conversationMessagesQueryDTO = new MessagesQueryDTO();
        $conversationMessagesQueryDTO->setConversationId($conversationId)->setLimit($limit)->setTopicId($topicId);
        // 获取话题的最近 20 条对话记录
        $clientSeqResponseDTOS = $this->magicChatDomainService->getConversationChatMessages($conversationId, $conversationMessagesQueryDTO);
        // 获取收发双方的用户信息，用于补全时增强角色类型
        $userIds = [];
        foreach ($clientSeqResponseDTOS as $clientSeqResponseDTO) {
            // 收集 user_id
            $userIds[] = $clientSeqResponseDTO->getSeq()->getMessage()->getSenderId();
        }
        // 把自己的 user_id 也加进去
        $userIds[] = $userAuthorization->getId();
        // 去重
        $userIds = array_values(array_unique($userIds));
        $userEntities = $this->magicUserDomainService->getUserByIdsWithoutOrganization($userIds);
        /** @var MagicUserEntity[] $userEntities */
        $userEntities = array_column($userEntities, null, 'user_id');
        $userMessages = [];
        foreach ($clientSeqResponseDTOS as $clientSeqResponseDTO) {
            $senderUserId = $clientSeqResponseDTO->getSeq()->getMessage()->getSenderId();
            $magicUserEntity = $userEntities[$senderUserId] ?? null;
            if ($magicUserEntity === null) {
                continue;
            }
            $message = $clientSeqResponseDTO->getSeq()->getMessage()->getContent();
            // 暂时只处理用户的输入，以及能获取纯文本的消息类型
            $messageContent = $this->getMessageTextContent($message);
            if (empty($messageContent)) {
                continue;
            }

            // 根据参数决定使用昵称还是传统的 role
            if ($useNicknameAsRole) {
                $userMessages[$clientSeqResponseDTO->getSeq()->getSeqId()] = [
                    'role' => $magicUserEntity->getNickname(),
                    'role_description' => $magicUserEntity->getDescription(),
                    'content' => $messageContent,
                ];
            } else {
                // 使用传统的 role，判断是否为 AI 用户
                $isAiUser = $magicUserEntity->getUserType() === UserType::Ai;
                $role = $isAiUser ? Role::Assistant : Role::User;

                $userMessages[$clientSeqResponseDTO->getSeq()->getSeqId()] = [
                    'role' => $role->value,
                    'content' => $messageContent,
                ];
            }
        }
        if (empty($userMessages)) {
            return [];
        }
        // 根据 seq_id 升序排列
        ksort($userMessages);
        return array_values($userMessages);
    }

    public function getMagicSeqEntity(string $magicMessageId, ConversationType $controlMessageType): ?MagicSeqEntity
    {
        $seqEntities = $this->magicSeqDomainService->getSeqEntitiesByMagicMessageId($magicMessageId);
        foreach ($seqEntities as $seqEntity) {
            if ($seqEntity->getObjectType() === $controlMessageType) {
                return $seqEntity;
            }
        }
        return null;
    }

    /**
     * Check the legality of editing a message.
     * Verify that the message to be edited meets one of the following conditions:
     * 1. The current user is the message sender
     * 2. The message is sent by an agent and the current user is the message receiver.
     *
     * @param MagicSeqEntity $senderSeqDTO Sender sequence DTO
     * @param DataIsolation $dataIsolation Data isolation object
     * @throws Throwable
     */
    protected function checkEditMessageLegality(
        MagicSeqEntity $senderSeqDTO,
        DataIsolation $dataIsolation
    ): void {
        // Check if this is an edit message operation
        $editMessageOptions = $senderSeqDTO->getExtra()?->getEditMessageOptions();
        if ($editMessageOptions === null) {
            return;
        }

        $magicMessageId = $editMessageOptions->getMagicMessageId();
        if (empty($magicMessageId)) {
            return;
        }

        try {
            // Get the message entity to be edited
            $messageEntity = $this->magicChatDomainService->getMessageByMagicMessageId($magicMessageId);
            if ($messageEntity === null) {
                ExceptionBuilder::throw(ChatErrorCode::MESSAGE_NOT_FOUND);
            }

            // Case 1: Check if the current user is the message sender
            if ($this->isCurrentUserMessage($messageEntity, $dataIsolation)) {
                return; // User can edit their own messages
            }

            // Case 2: Check if the message is sent by an agent to the current user
            if ($this->isAgentMessageToCurrentUser($messageEntity, $magicMessageId, $dataIsolation)) {
                return; // User can edit agent messages sent to them
            }

            // If neither condition is met, reject the edit
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_NOT_FOUND);
        } catch (Throwable $exception) {
            $this->logger->error(sprintf(
                'checkEditMessageLegality error: %s, magicMessageId: %s, currentUserId: %s',
                $exception->getMessage(),
                $magicMessageId,
                $dataIsolation->getCurrentUserId()
            ));
            throw $exception;
        }
    }

    /**
     * 为了保证收发双方的消息顺序一致性，如果是私聊，则同步生成 seq.
     * @throws Throwable
     */
    private function syncHandlerSingleChatMessage(MagicSeqEntity $senderSeqEntity, MagicMessageEntity $senderMessageEntity): MagicSeqEntity
    {
        $magicSeqStatus = MagicMessageStatus::Unread;
        # 助理可能参与私聊/群聊等场景,读取记忆时,需要读取自己会话窗口下的消息.
        $receiveSeqEntity = $this->magicChatDomainService->generateReceiveSequenceByChatMessage($senderSeqEntity, $senderMessageEntity, $magicSeqStatus);
        // 避免 seq 表承载太多功能,加太多索引,因此将话题的消息单独写入到 topic_messages 表中
        $this->magicChatDomainService->createTopicMessage($receiveSeqEntity);
        return $receiveSeqEntity;
    }

    /**
     * 使用大模型生成内容摘要
     *
     * @param MagicUserAuthorization $authorization 用户授权信息
     * @param MessageHistory $messageHistory 消息历史
     * @param string $conversationId 会话ID
     * @param string $topicId 话题ID，可选
     * @return string 生成的摘要文本
     */
    private function getSummaryFromLLM(
        MagicUserAuthorization $authorization,
        MessageHistory $messageHistory,
        string $conversationId,
        string $topicId = ''
    ): string {
        $orgCode = $authorization->getOrganizationCode();
        $dataIsolation = $this->createDataIsolation($authorization);
        $chatModelName = di(ModelConfigAppService::class)->getChatModelTypeByFallbackChain($orgCode, LLMModelEnum::DEEPSEEK_V3->value);

        # 开始请求大模型
        $modelGatewayMapper = di(ModelGatewayMapper::class);
        $model = $modelGatewayMapper->getChatModelProxy($chatModelName, $orgCode);
        $memoryManager = $messageHistory->getMemoryManager($conversationId);
        $agent = AgentFactory::create(
            model: $model,
            memoryManager: $memoryManager,
            temperature: 0.6,
            businessParams: [
                'organization_id' => $dataIsolation->getCurrentOrganizationCode(),
                'user_id' => $dataIsolation->getCurrentUserId(),
                'business_id' => $topicId ?: $conversationId,
                'source_id' => 'summary_content',
            ],
        );

        $chatCompletionResponse = $agent->chatAndNotAutoExecuteTools();
        $choiceContent = $chatCompletionResponse->getFirstChoice()?->getMessage()->getContent();
        // 如果标题长度超过20个字符则后面的用...代替
        if (mb_strlen($choiceContent) > 20) {
            $choiceContent = mb_substr($choiceContent, 0, 20) . '...';
        }

        return $choiceContent;
    }

    private function getMessageTextContent(MessageInterface $message): string
    {
        // 暂时只处理用户的输入，以及能获取纯文本的消息类型
        if ($message instanceof TextContentInterface) {
            $messageContent = $message->getTextContent();
        } else {
            $messageContent = '';
        }
        return $messageContent;
    }

    /**
     * @param ClientSequenceResponse[] $clientSeqList
     */
    private function formatConversationMessagesReturn(array $clientSeqList, MessagesQueryDTO $conversationMessagesQueryDTO): array
    {
        $data = [];
        foreach ($clientSeqList as $clientSeq) {
            $seqId = $clientSeq->getSeq()->getSeqId();
            $data[$seqId] = $clientSeq->toArray();
        }
        $hasMore = (count($clientSeqList) === $conversationMessagesQueryDTO->getLimit());
        // 按照 $order 在数据库中查询，但是对返回的结果集降序排列了。
        $order = $conversationMessagesQueryDTO->getOrder();
        if ($order === Order::Desc) {
            // 对 $data 降序排列
            krsort($data);
        } else {
            // 对 $data 升序排列
            ksort($data);
        }
        $pageToken = (string) array_key_last($data);
        return PageListAssembler::pageByElasticSearch(array_values($data), $pageToken, $hasMore);
    }

    private function getAgentAuth(MagicUserEntity $aiUserEntity): MagicUserAuthorization
    {
        // 创建userAuth
        $userAuthorization = new MagicUserAuthorization();
        $userAuthorization->setStatus((string) $aiUserEntity->getStatus()->value);
        $userAuthorization->setId($aiUserEntity->getUserId());
        $userAuthorization->setNickname($aiUserEntity->getNickname());
        $userAuthorization->setOrganizationCode($aiUserEntity->getOrganizationCode());
        $userAuthorization->setMagicId($aiUserEntity->getMagicId());
        $userAuthorization->setUserType($aiUserEntity->getUserType());
        return $userAuthorization;
    }

    private function createAgentMessageDTO(
        MagicSeqEntity $aiSeqDTO,
        MagicUserEntity $aiUserEntity,
        MagicConversationEntity $aiConversationEntity,
        string $appMessageId,
        Carbon $sendTime
    ): MagicMessageEntity {
        // 创建消息
        $messageDTO = new MagicMessageEntity();
        $messageDTO->setMessageType($aiSeqDTO->getSeqType());
        $messageDTO->setSenderId($aiUserEntity->getUserId());
        $messageDTO->setSenderType(ConversationType::Ai);
        $messageDTO->setSenderOrganizationCode($aiUserEntity->getOrganizationCode());
        $messageDTO->setReceiveId($aiConversationEntity->getReceiveId());
        $messageDTO->setReceiveType(ConversationType::User);
        $messageDTO->setReceiveOrganizationCode($aiConversationEntity->getReceiveOrganizationCode());
        $messageDTO->setAppMessageId($appMessageId);
        $messageDTO->setMagicMessageId('');
        $messageDTO->setSendTime($sendTime->toDateTimeString());
        // type和content组合在一起才是一个可用的消息类型
        $messageDTO->setContent($aiSeqDTO->getContent());
        $messageDTO->setMessageType($aiSeqDTO->getSeqType());
        return $messageDTO;
    }

    private function pushReceiveChatSequence(MagicMessageEntity $messageEntity, MagicSeqEntity $seq): void
    {
        $receiveType = $messageEntity->getReceiveType();
        $seqCreatedEvent = $this->magicChatDomainService->getChatSeqPushEvent($receiveType, $seq->getSeqId(), 1);
        $this->magicChatDomainService->pushChatSequence($seqCreatedEvent);
    }

    /**
     * 根据客户端发来的聊天消息类型,分发到对应的处理模块.
     * @throws Throwable
     */
    private function dispatchClientChatMessage(
        MagicSeqEntity $senderSeqDTO,
        MagicMessageEntity $senderMessageDTO,
        MagicUserAuthorization $userAuthorization,
        MagicConversationEntity $senderConversationEntity
    ): array {
        $lockKey = sprintf('messageDispatch:lock:%s', $senderConversationEntity->getId());
        $owner = uniqid('', true);
        try {
            $this->locker->spinLock($lockKey, $owner, 5);
            $chatMessageType = $senderMessageDTO->getMessageType();
            if (! $chatMessageType instanceof ChatMessageType) {
                ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR);
            }
            $dataIsolation = $this->createDataIsolation($userAuthorization);
            // 消息鉴权
            $this->checkSendMessageAuth($senderSeqDTO, $senderMessageDTO, $senderConversationEntity, $dataIsolation);
            // 安全性保证，校验附件中的文件是否属于当前用户
            $senderMessageDTO = $this->checkAndFillAttachments($senderMessageDTO, $dataIsolation);
            // 业务参数校验
            $this->validateBusinessParams($senderMessageDTO, $dataIsolation);
            // 消息分发
            $conversationType = $senderConversationEntity->getReceiveType();
            return match ($conversationType) {
                ConversationType::Ai,
                ConversationType::User,
                ConversationType::Group => $this->magicChat($senderSeqDTO, $senderMessageDTO, $senderConversationEntity),
                default => ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_TYPE_ERROR),
            };
        } finally {
            $this->locker->release($lockKey, $owner);
        }
    }

    /**
     * 校验附件中的文件是否属于当前用户,并填充附件信息.（文件名/类型等字段）.
     */
    private function checkAndFillAttachments(MagicMessageEntity $senderMessageDTO, DataIsolation $dataIsolation): MagicMessageEntity
    {
        $content = $senderMessageDTO->getContent();
        if (! $content instanceof AbstractAttachmentMessage) {
            return $senderMessageDTO;
        }
        $attachments = $content->getAttachments();
        if (empty($attachments)) {
            return $senderMessageDTO;
        }
        $attachments = $this->magicChatFileDomainService->checkAndFillAttachments($attachments, $dataIsolation);
        $content->setAttachments($attachments);
        return $senderMessageDTO;
    }

    /**
     * Check if the message is sent by the current user.
     */
    private function isCurrentUserMessage(MagicMessageEntity $messageEntity, DataIsolation $dataIsolation): bool
    {
        return $messageEntity->getSenderId() === $dataIsolation->getCurrentUserId();
    }

    /**
     * Check if the message is sent by an agent to the current user.
     */
    private function isAgentMessageToCurrentUser(MagicMessageEntity $messageEntity, string $magicMessageId, DataIsolation $dataIsolation): bool
    {
        // First check if the message is sent by an agent
        if ($messageEntity->getSenderType() !== ConversationType::Ai) {
            return false;
        }

        // Get all seq entities for this message
        $seqEntities = $this->magicSeqDomainService->getSeqEntitiesByMagicMessageId($magicMessageId);
        if (empty($seqEntities)) {
            return false;
        }

        // Check if the current user is the receiver of this message
        $currentMagicId = $dataIsolation->getCurrentMagicId();
        foreach ($seqEntities as $seqEntity) {
            if ($seqEntity->getObjectId() === $currentMagicId) {
                return true;
            }
        }

        return false;
    }

    /**
     * 检查会话所有权
     * 确保所有的会话ID都属于当前账号，否则抛出异常.
     *
     * @param MagicUserAuthorization $userAuthorization 用户授权信息
     * @param array $conversationIds 待检查的会话ID数组
     */
    private function checkConversationsOwnership(MagicUserAuthorization $userAuthorization, array $conversationIds): void
    {
        if (empty($conversationIds)) {
            return;
        }

        // 批量获取会话信息
        $conversations = $this->magicChatDomainService->getConversationsByIds($conversationIds);
        if (empty($conversations)) {
            return;
        }

        // 收集所有会话关联的用户ID
        $userIds = [];
        foreach ($conversations as $conversation) {
            $userIds[] = $conversation->getUserId();
        }
        $userIds = array_unique($userIds);

        // 批量获取用户信息
        $userEntities = $this->magicUserDomainService->getUserByIdsWithoutOrganization($userIds);
        $userMap = array_column($userEntities, 'magic_id', 'user_id');

        // 检查每个会话是否属于当前用户（通过magic_id匹配）
        $currentMagicId = $userAuthorization->getMagicId();
        foreach ($conversationIds as $id) {
            $conversationEntity = $conversations[$id] ?? null;
            if (! isset($conversationEntity)) {
                ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
            }

            $userId = $conversationEntity->getUserId();
            $userMagicId = $userMap[$userId] ?? null;

            if ($userMagicId !== $currentMagicId) {
                ExceptionBuilder::throw(ChatErrorCode::CONVERSATION_NOT_FOUND);
            }
        }
    }

    /**
     * 业务参数校验
     * 对特定类型的消息进行业务规则校验.
     */
    private function validateBusinessParams(MagicMessageEntity $senderMessageDTO, DataIsolation $dataIsolation): void
    {
        $content = $senderMessageDTO->getContent();
        $messageType = $senderMessageDTO->getMessageType();

        // 语音消息校验
        if ($messageType === ChatMessageType::Voice && $content instanceof VoiceMessage) {
            $this->validateVoiceMessageParams($content, $dataIsolation);
        }
    }

    /**
     * 校验语音消息的业务参数.
     */
    private function validateVoiceMessageParams(VoiceMessage $voiceMessage, DataIsolation $dataIsolation): void
    {
        // 校验附件
        $attachments = $voiceMessage->getAttachments();
        if (empty($attachments)) {
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR, 'chat.message.voice.attachment_required');
        }

        if (count($attachments) !== 1) {
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR, 'chat.message.voice.single_attachment_only', ['count' => count($attachments)]);
        }

        // 使用新的 getAttachment() 方法获取第一个附件
        $attachment = $voiceMessage->getAttachment();
        if ($attachment === null) {
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR, 'chat.message.voice.attachment_empty');
        }

        // 根据音频的 file_id 调用文件领域获取详情，并填充附件缺失的属性值
        $this->fillVoiceAttachmentDetails($voiceMessage, $dataIsolation);

        // 重新获取填充后的附件
        $attachment = $voiceMessage->getAttachment();

        if ($attachment->getFileType() !== FileType::Audio) {
            ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR, 'chat.message.voice.audio_format_required', ['type' => $attachment->getFileType()->name]);
        }

        // 校验录音时长
        $duration = $voiceMessage->getDuration();
        if ($duration !== null) {
            if ($duration <= 0) {
                ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR, 'chat.message.voice.duration_positive', ['duration' => $duration]);
            }

            // 默认最大60秒
            $maxDuration = 60;
            if ($duration > $maxDuration) {
                ExceptionBuilder::throw(ChatErrorCode::MESSAGE_TYPE_ERROR, 'chat.message.voice.duration_exceeds_limit', ['max_duration' => $maxDuration, 'duration' => $duration]);
            }
        }
    }

    /**
     * 根据音频的 file_id 调用文件领域获取详情，并填充 VoiceMessage 继承的 ChatAttachment 缺失的属性值.
     */
    private function fillVoiceAttachmentDetails(VoiceMessage $voiceMessage, DataIsolation $dataIsolation): void
    {
        $attachments = $voiceMessage->getAttachments();
        if (empty($attachments)) {
            return;
        }

        // 调用文件领域服务填充附件详情
        $filledAttachments = $this->magicChatFileDomainService->checkAndFillAttachments($attachments, $dataIsolation);

        // 更新语音消息的附件信息
        $voiceMessage->setAttachments($filledAttachments);
    }
}
