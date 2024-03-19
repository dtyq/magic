<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Agent\Service;

use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformChatEvent;
use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformChatFactory;
use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformChatMessage;
use App\Application\Agent\Service\ThirdPlatformChat\ThirdPlatformCreateGroup;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionType;
use App\Application\Flow\ExecuteManager\ExecutionData\TriggerData;
use App\Application\Flow\ExecuteManager\MagicFlowExecutor;
use App\Application\Kernel\EnvManager;
use App\Application\Kernel\SuperPermissionEnum;
use App\Domain\Agent\Entity\MagicBotThirdPlatformChatEntity;
use App\Domain\Agent\Entity\ValueObject\Query\MagicBotThirdPlatformChatQuery;
use App\Domain\Agent\Entity\ValueObject\ThirdPlatformChat\ThirdPlatformChatType;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Contact\Entity\AccountEntity;
use App\Domain\Flow\Entity\MagicFlowEntity;
use App\Domain\Flow\Entity\ValueObject\ConversationId;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure\TriggerType;
use App\Domain\Flow\Service\MagicFlowMemoryHistoryDomainService;
use App\Domain\Group\Entity\MagicGroupEntity;
use App\ErrorCode\AgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Context\CoContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use DateTime;
use Hyperf\Coroutine\Coroutine;
use Hyperf\Coroutine\Parallel;
use Nyholm\Psr7\Response;
use Qbhy\HyperfAuth\Authenticatable;
use Throwable;

class MagicBotThirdPlatformChatAppService extends AbstractAppService
{
    public function chat(string $key, array $params): ThirdPlatformChatMessage
    {
        if (empty($key)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'key']);
        }

        // 特殊逻辑，如果是飞书，并且是challenge
        $platform = $params['platform'] ?? '';
        if ($platform === ThirdPlatformChatType::FeiShuRobot->value && isset($params['challenge'])) {
            $chatMessage = new ThirdPlatformChatMessage();
            $chatMessage->setEvent(ThirdPlatformChatEvent::CheckServer);
            $response = new Response(
                200,
                ['Content-Type' => 'application/json'],
                json_encode(['challenge' => $params['challenge']], JSON_UNESCAPED_UNICODE)
            );
            $chatMessage->setResponse($response);
            return $chatMessage;
        }

        $chatEntity = $this->magicBotThirdPlatformChatDomainService->getByKey($key);
        if (! $chatEntity || ! $chatEntity->isEnabled()) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.invalid', ['label' => $key]);
        }
        $dataIsolation = FlowDataIsolation::create('', '')->setEnabled(false);
        $magicFlow = $this->getFlowByBotId($dataIsolation, $chatEntity->getBotId());
        $dataIsolation->setCurrentOrganizationCode($magicFlow->getOrganizationCode());

        $thirdPlatformChat = ThirdPlatformChatFactory::make($chatEntity);
        $params['magic_system'] = [
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
        ];
        $thirdPlatformChatMessage = $thirdPlatformChat->parseChatParam($params);
        switch ($thirdPlatformChatMessage->getEvent()) {
            case ThirdPlatformChatEvent::None:
                break;
            case ThirdPlatformChatEvent::CheckServer:
                return $thirdPlatformChatMessage;
            case ThirdPlatformChatEvent::ChatMessage:
                $thirdPlatformChatMessage->validate();
                $fromCoroutineId = Coroutine::id();
                Coroutine::defer(function () use ($dataIsolation, $magicFlow, $thirdPlatformChat, $thirdPlatformChatMessage, $chatEntity, $fromCoroutineId) {
                    CoContext::copy($fromCoroutineId);
                    try {
                        $originConversationId = $thirdPlatformChatMessage->getConversationId();
                        $conversationId = ConversationId::ThirdBotChat->gen($chatEntity->getType()->getConversationPrefix() . '-' . $originConversationId);

                        if ($thirdPlatformChatMessage->getMessage() === '/clear_memory') {
                            $this->clearMemory($conversationId);
                            $message = new TextMessage(['content' => $thirdPlatformChatMessage->getMessage() . ' success']);
                            $thirdPlatformChat->sendMessage($thirdPlatformChatMessage, $message);
                            return;
                        }

                        // 这里是各个平台的用户 id，不是 magic 的 user_id
                        $userId = $thirdPlatformChatMessage->getUserId();
                        $dataIsolation->setCurrentUserId($userId);
                        EnvManager::initDataIsolationEnv($dataIsolation);

                        $operator = $this->createExecutionOperator($dataIsolation);
                        $operator->setNickname($thirdPlatformChatMessage->getNickname());
                        $operator->setSourceId($chatEntity->getType()->value);

                        $attachments = $thirdPlatformChatMessage->getAttachments();
                        foreach ($attachments as $attachment) {
                            $attachment->setNeedUpload(true);
                            $attachment->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
                        }

                        $message = new TextMessage(['content' => $thirdPlatformChatMessage->getMessage()]);
                        $triggerData = new TriggerData(
                            triggerTime: new DateTime(),
                            userInfo: ['user_entity' => TriggerData::createUserEntity($operator->getUid(), $operator->getNickname())],
                            messageInfo: ['message_entity' => TriggerData::createMessageEntity($message)],
                            globalVariable: $magicFlow->getGlobalVariable(),
                            attachments: $attachments,
                            triggerDataUserExtInfo: $thirdPlatformChatMessage->getUserExtInfo(),
                        );

                        $executionData = new ExecutionData(
                            flowDataIsolation: $dataIsolation,
                            operator: $operator,
                            triggerType: TriggerType::ChatMessage,
                            triggerData: $triggerData,
                            conversationId: $conversationId,
                            originConversationId: $originConversationId,
                            executionType: ExecutionType::SKApi,
                        );
                        $executor = new MagicFlowExecutor($magicFlow, $executionData);
                        $executor->execute();

                        foreach ($executionData->getReplyMessages() as $message) {
                            if ($message->getIMMessage()) {
                                $message->replaceAttachmentUrl(true);
                                $thirdPlatformChat->sendMessage($thirdPlatformChatMessage, $message->getIMMessage());
                            }
                        }
                    } catch (Throwable $exception) {
                        simple_logger('MagicBotThirdPlatformChatAppService')->notice('ChatError', [
                            'exception' => $exception->getMessage(),
                            'file' => $exception->getFile(),
                            'line' => $exception->getLine(),
                            'code' => $exception->getCode(),
                            'trace' => $exception->getTraceAsString(),
                        ]);
                        $message = new TextMessage(['content' => '不好意思，同时问我问题的人太多啦，有点忙不过来，你可以一会儿再来问我吗？感谢谅解！']);
                        $thirdPlatformChat->sendMessage($thirdPlatformChatMessage, $message);
                    }
                });
                break;
        }
        return $thirdPlatformChatMessage;
    }

    public function save(Authenticatable $authorization, MagicBotThirdPlatformChatEntity $entity): MagicBotThirdPlatformChatEntity
    {
        $this->checkInternalWhite($authorization, SuperPermissionEnum::ASSISTANT_ADMIN);
        $entity->setAllUpdate(true);
        $entity = $this->magicBotThirdPlatformChatDomainService->save($entity);
        ThirdPlatformChatFactory::remove((string) $entity->getId());
        return $entity;
    }

    public function destroy(Authenticatable $authorization, string $id): void
    {
        $this->checkInternalWhite($authorization, SuperPermissionEnum::ASSISTANT_ADMIN);
        $entity = $this->magicBotThirdPlatformChatDomainService->getById((int) $id);
        if ($entity) {
            $this->magicBotThirdPlatformChatDomainService->destroy($entity);
            ThirdPlatformChatFactory::remove($id);
        }
    }

    /**
     * @return array{total: int, list: MagicBotThirdPlatformChatEntity[]}
     */
    public function listByBotId(Authenticatable $authorization, string $botId, Page $page): array
    {
        if (empty($botId)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'bot_id']);
        }
        $permissionDataIsolation = $this->createPermissionDataIsolation($authorization);
        $this->getAgentOperation($permissionDataIsolation, $botId)->validate('r', $botId);
        $query = new MagicBotThirdPlatformChatQuery();
        $query->setBotId($botId);
        return $this->magicBotThirdPlatformChatDomainService->queries($query, $page);
    }

    /**
     * @return array{total: int, list: MagicBotThirdPlatformChatEntity[]}
     */
    public function queries(Authenticatable $authorization, MagicBotThirdPlatformChatQuery $query, Page $page): array
    {
        $this->checkInternalWhite($authorization, SuperPermissionEnum::ASSISTANT_ADMIN);
        return $this->magicBotThirdPlatformChatDomainService->queries($query, $page);
    }

    public function createChatGroup(string $key, array $groupMemberIds, MagicUserAuthorization $userAuthorization, MagicGroupEntity $magicGroupDTO): string
    {
        // 获取助理配置
        if (empty($key)) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.empty', ['label' => 'key']);
        }
        $chatEntity = $this->magicBotThirdPlatformChatDomainService->getByKey($key);
        if (! $chatEntity || ! $chatEntity->isEnabled()) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.invalid', ['label' => $key]);
        }
        // 通过 $groupMemberIds 获取用户信息，可以用户列表
        $dataIsolation = $this->createDataIsolation($userAuthorization);
        $users = $this->magicUserDomainService->getUserByIds($groupMemberIds, $dataIsolation, ['magic_id', 'nickname']);
        if (count($users) === 0) {
            ExceptionBuilder::throw(AgentErrorCode::CREATE_GROUP_USER_NOT_EXIST, 'user.not_exist', ['user_ids' => $groupMemberIds]);
        }
        $magicIds = array_column($users, 'magic_id');
        /** @var array<string, AccountEntity> $accounts */
        $accounts = $this->magicAccountDomainService->getAccountByMagicIds($magicIds);
        if (count($accounts) === 0) {
            ExceptionBuilder::throw(AgentErrorCode::CREATE_GROUP_USER_ACCOUNT_NOT_EXIST, 'user.not_exist', ['magic_ids' => $magicIds]);
        }
        // 调用接口，换取第三方的用户 id
        $parallel = new Parallel(2);
        $thirdPlatformChat = ThirdPlatformChatFactory::make($chatEntity);
        $requestId = CoContext::getRequestId();
        foreach ($accounts as $account) {
            $parallel->add(function () use ($requestId, $thirdPlatformChat, $account) {
                CoContext::setRequestId($requestId);
                return ['magic_id' => $account->getMagicId(), 'third_user_id' => $thirdPlatformChat->getThirdPlatformUserIdByMobiles($account->getPhone())];
            });
        }
        $thirdPlatformUserIds = [];
        $ownerThirdPlatformUserId = '';
        $result = $parallel->wait();
        // 二位数组转成一维
        foreach ($result as $item) {
            if ($item['magic_id'] == $userAuthorization->getMagicId()) {
                $ownerThirdPlatformUserId = $item['third_user_id'];
            }
            $thirdPlatformUserIds[] = $item['third_user_id'];
        }
        if (count($thirdPlatformUserIds) == 0) {
            ExceptionBuilder::throw(AgentErrorCode::GET_THIRD_PLATFORM_USER_ID_FAILED, 'user.not_exist', ['magic_ids' => $magicIds]);
        }

        // 创建群聊
        $createGroupParams = new ThirdPlatformCreateGroup();
        $createGroupParams->setName($magicGroupDTO->getGroupName());
        $createGroupParams->setOwner($ownerThirdPlatformUserId);
        $createGroupParams->setUseridlist($thirdPlatformUserIds);
        $createGroupParams->setShowHistoryType(1);
        $createGroupParams->setSearchable(0);
        $createGroupParams->setValidationType(0);
        $createGroupParams->setMentionAllAuthority(0);
        $createGroupParams->setManagementType(0);
        $createGroupParams->setChatBannedType(0);

        return $thirdPlatformChat->createGroup($createGroupParams);
    }

    private function clearMemory(string $conversationId): void
    {
        // 清理 flow 的自身记忆，仅更改原会话为备份会话
        di(MagicFlowMemoryHistoryDomainService::class)->removeByConversationId(
            FlowDataIsolation::create('', ''),
            $conversationId
        );
    }

    private function getFlowByBotId(FlowDataIsolation $dataIsolation, string $botId): MagicFlowEntity
    {
        $bot = $this->magicAgentDomainService->getAgentById($botId);
        if (! $bot->isAvailable()) {
            ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'common.invalid', ['label' => 'bot_id']);
        }
        if ($bot->getAgentVersionId()) {
            $botVersion = $this->magicAgentVersionDomainService->getById($bot->getAgentVersionId());
            $flowVersion = $this->magicFlowVersionDomainService->show($dataIsolation, $bot->getFlowCode(), $botVersion->getFlowVersion());
            $magicFlow = $flowVersion->getMagicFlow();
            $magicFlow->setVersionCode($flowVersion->getCode());
        } else {
            $magicFlow = $this->magicFlowDomainService->getByCode($dataIsolation, $bot->getFlowCode());
        }
        $magicFlow->setAgentId((string) $bot->getId());

        // 使用当前流程的组织编码
        $dataIsolation->setCurrentOrganizationCode($magicFlow->getOrganizationCode());
        return $magicFlow;
    }
}
