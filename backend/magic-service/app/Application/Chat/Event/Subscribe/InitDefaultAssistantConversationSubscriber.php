<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Event\Subscribe;

use App\Application\Agent\Service\MagicAgentAppService;
use App\Application\Chat\Service\MagicAccountAppService;
use App\Domain\Agent\Service\MagicAgentDomainService;
use App\Domain\Agent\Service\MagicAgentVersionDomainService;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\UserStatus;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Result;
use Hyperf\Logger\LoggerFactory;
use PhpAmqpLib\Message\AMQPMessage;
use Psr\Log\LoggerInterface;
use Throwable;

#[Consumer(exchange: 'init_default_assistant_conversation', routingKey: 'init_default_assistant_conversation', queue: 'init_default_assistant_conversation', nums: 1)]
class InitDefaultAssistantConversationSubscriber extends ConsumerMessage
{
    private LoggerInterface $logger;

    public function __construct(
        protected MagicAgentAppService $magicAgentAppService,
        protected MagicAgentDomainService $magicAgentDomainService,
        protected MagicUserDomainService $magicUserDomainService,
        protected MagicAgentVersionDomainService $magicAgentVersionDomainService,
        protected MagicUserAuthorization $magicUserAuthorization,
        protected MagicAccountAppService $magicAccountAppService,
    ) {
        $this->logger = di(LoggerFactory::class)->get(get_class($this));
    }

    public function consumeMessage($data, AMQPMessage $message): Result
    {
        try {
            $data['user_entity']['user_type'] = UserType::tryFrom($data['user_entity']['user_type']);
            $data['user_entity']['status'] = UserStatus::tryFrom($data['user_entity']['status']);
            $data['user_entity']['like_num'] = (int) $data['user_entity']['like_num'];
            /** @var MagicUserEntity $userEntity */
            $userEntity = new MagicUserEntity($data['user_entity']);
            /** @var array<string> $defaultConversationAICodes */
            $defaultConversationAICodes = $data['default_conversation_ai_codes'];
            // 先批量注册，防止组织下没有该助理用户.
            $this->batchAiRegister($userEntity, $defaultConversationAICodes);
            // 初始化默认会话
            $this->magicAgentAppService->initDefaultAssistantConversation($userEntity, $defaultConversationAICodes);
            return Result::ACK;
        } catch (Throwable $exception) {
            $this->logger->error("初始化默认会话失败，错误信息: {$exception->getMessage()}, 堆栈: {$exception->getTraceAsString()}");
            return Result::ACK;
        }
    }

    /**
     * 注册助理，防止组织下没有该助理用户.
     */
    public function batchAiRegister(MagicUserEntity $userEntity, ?array $defaultConversationAICodes = null): void
    {
        $authorization = MagicUserAuthorization::fromUserEntity($userEntity);
        $defaultConversationAICodes = $defaultConversationAICodes ?? $this->magicAgentDomainService->getDefaultConversationAICodes();
        foreach ($defaultConversationAICodes as $aiCode) {
            $magicAgentVersionEntity = $this->magicAgentVersionDomainService->getAgentByFlowCode($aiCode);
            $agentName = $magicAgentVersionEntity->getAgentName();
            $this->logger->info("注册助理，aiCode: {$aiCode}, 名称: {$agentName}");
            try {
                $aiUserDTO = MagicUserEntity::fromMagicAgentVersionEntity($magicAgentVersionEntity);
                $this->magicAccountAppService->aiRegister($aiUserDTO, $authorization, $aiCode);
                $this->logger->info("注册助理成功，aiCode: {$aiCode}, 名称: {$agentName}");
            } catch (Throwable $e) {
                $errorMessage = $e->getMessage();
                $trace = $e->getTraceAsString();
                $this->logger->error("注册助理失败，aiCode: {$aiCode}, 名称: {$agentName}\n错误信息: {$errorMessage}\n堆栈: {$trace} ");
            }
        }
    }
}
