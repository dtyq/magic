<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Message\Chat\Service;

use App\Application\SuperMagic\Common\Service\AbstractAppService;
use App\Application\SuperMagic\Common\Service\AccountAppService;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Service\MagicConversationDomainService;
use App\Domain\Chat\Service\MagicTopicDomainService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\SuperMagic\Task\Constant\AgentConstant;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class ChatAppService extends AbstractAppService
{
    protected LoggerInterface $logger;

    public function __construct(
        protected MagicUserDomainService $userDomainService,
        protected AccountAppService $accountAppService,
        protected MagicConversationDomainService $magicConversationDomainService,
        protected MagicTopicDomainService $topicDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /** @return array{sender_conversation_id: string, receiver_conversation_id: string} */
    public function getOrCreateMagicChatConversationPair(DataIsolation $dataIsolation): array
    {
        if (Db::connection()->transactionLevel() !== 0) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, '会话身份创建不能嵌套业务事务');
        }
        $aiUser = $this->getOrCreateSuperMagicUser($dataIsolation);
        return $this->magicConversationDomainService->getOrCreateConversationPair($dataIsolation, $aiUser->getUserId());
    }

    /**
     * @param array{sender_conversation_id: string, receiver_conversation_id: string} $pair
     * @return array{chat_conversation_id: string, receive_conversation_id: string, chat_topic_id: string}
     */
    public function createMagicChatTopicForConversationPair(DataIsolation $dataIsolation, array $pair): array
    {
        if (Db::connection()->transactionLevel() < 1) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, '话题创建必须在业务事务内执行');
        }
        $sender = $this->magicConversationDomainService->getConversationById($pair['sender_conversation_id'], $dataIsolation);
        $receiver = $this->magicConversationDomainService->getConversationByIdWithoutCheck($pair['receiver_conversation_id']);
        $aiUser = $this->userDomainService->getByAiCode($dataIsolation, AgentConstant::SUPER_MAGIC_CODE);
        if ($receiver === null || $aiUser === null || $sender->getReceiveType() !== ConversationType::Ai
            || $receiver->getReceiveType() !== ConversationType::User
            || $sender->getReceiveId() !== $aiUser->getUserId()) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, '会话对不属于当前用户与 Super Magic');
        }
        $topicId = $this->topicDomainService->createConversationTopicPair($sender->getId(), $receiver->getId());
        return [
            'chat_conversation_id' => $sender->getId(),
            'receive_conversation_id' => $receiver->getId(),
            'chat_topic_id' => $topicId,
        ];
    }

    /** @param array{chat_conversation_id: string, receive_conversation_id: string, chat_topic_id: string} $context */
    public function setMagicChatDefaultTopic(array $context): void
    {
        $this->topicDomainService->setConversationDefaultTopicPair(
            $context['chat_conversation_id'],
            $context['receive_conversation_id'],
            $context['chat_topic_id']
        );
    }

    /**
     * Get the Super Magic agent user ID for the given organization.
     * This method retrieves the AI user entity for the Super Magic agent
     * and returns its user ID.
     *
     * @param DataIsolation $dataIsolation data isolation context
     * @return string the agent user ID
     * @throws Throwable if the agent user is not found
     */
    public function getSuperMagicAgentUserId(DataIsolation $dataIsolation): string
    {
        return $this->getOrCreateSuperMagicUser($dataIsolation)?->getUserId();
    }

    /**
     * Get the AI agent's conversation ID for sending messages TO the human user.
     *
     * aiSendMessage() requires the conversation owned by the AI (user_id = AI, receive_id = human).
     * The conversation stored on the topic entity is the human's conversation (user_id = human),
     * which would cause aiSendMessage to throw USER_NOT_EXIST because the owner is not an AI user.
     *
     * @param DataIsolation $dataIsolation data isolation context
     * @return string the AI agent's conversation ID (AI → human direction)
     * @throws Throwable if the agent user or conversation is not found
     */
    public function getSuperMagicAgentConversationId(DataIsolation $dataIsolation): string
    {
        $aiUserId = $this->getSuperMagicAgentUserId($dataIsolation);
        $humanUserId = $dataIsolation->getCurrentUserId();

        $agentConversation = $this->magicConversationDomainService->getOrCreateConversation(
            $aiUserId,             // AI is the owner/sender
            $humanUserId,          // human is the receiver
            ConversationType::User // human side receive type
        );

        return $agentConversation->getId();
    }

    /**
     * Get or create the Super Magic AI user entity.
     * This is a private method to avoid code duplication between different public methods.
     *
     * @param DataIsolation $dataIsolation data isolation context
     * @return object the AI user entity
     * @throws Throwable if the agent user is not found after initialization attempts
     */
    private function getOrCreateSuperMagicUser(DataIsolation $dataIsolation): object
    {
        $this->logger->info(sprintf('Attempting to get AI user with code: %s for organization: %s', AgentConstant::SUPER_MAGIC_CODE, $dataIsolation->getCurrentOrganizationCode()));
        $aiUserEntity = $this->userDomainService->getByAiCode($dataIsolation, AgentConstant::SUPER_MAGIC_CODE);

        if (empty($aiUserEntity)) {
            $this->logger->info(sprintf('AI user with code %s not found, attempting to initialize account for organization: %s', AgentConstant::SUPER_MAGIC_CODE, $dataIsolation->getCurrentOrganizationCode()));
            // Manually perform initialization if AI user is not found
            $this->accountAppService->initAccount($dataIsolation->getCurrentOrganizationCode());
            // Query again
            $aiUserEntity = $this->userDomainService->getByAiCode($dataIsolation, AgentConstant::SUPER_MAGIC_CODE);
            if (empty($aiUserEntity)) {
                $this->logger->error(sprintf('AI user with code %s still not found after attempting initialization for organization: %s', AgentConstant::SUPER_MAGIC_CODE, $dataIsolation->getCurrentOrganizationCode()));
                ExceptionBuilder::throw(GenericErrorCode::SystemError, 'workspace.super_magic_user_not_found');
            }
            $this->logger->info(sprintf('AI user with code %s found after initialization for organization: %s', AgentConstant::SUPER_MAGIC_CODE, $dataIsolation->getCurrentOrganizationCode()));
        } else {
            $this->logger->info(sprintf('AI user with code %s found for organization: %s', AgentConstant::SUPER_MAGIC_CODE, $dataIsolation->getCurrentOrganizationCode()));
        }

        return $aiUserEntity;
    }
}
