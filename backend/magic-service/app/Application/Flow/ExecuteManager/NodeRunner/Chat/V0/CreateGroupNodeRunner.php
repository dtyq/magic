<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Flow\ExecuteManager\NodeRunner\Chat\V0;

use App\Application\Agent\Service\MagicBotThirdPlatformChatAppService;
use App\Application\Chat\Service\MagicChatGroupAppService;
use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Application\Flow\ExecuteManager\ExecutionData\ExecutionData;
use App\Application\Flow\ExecuteManager\NodeRunner\NodeRunner;
use App\Domain\Chat\DTO\Message\ChatMessage\TextMessage;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Chat\V0\CreateGroupNodeParamsConfig;
use App\Domain\Flow\Entity\ValueObject\NodeType;
use App\Domain\Group\Entity\MagicGroupEntity;
use App\Domain\Group\Entity\ValueObject\GroupStatusEnum;
use App\Domain\Group\Entity\ValueObject\GroupTypeEnum;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Collector\ExecuteManager\Annotation\FlowNodeDefine;
use App\Infrastructure\Core\Dag\VertexResult;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;

#[FlowNodeDefine(
    type: NodeType::CreateGroup->value,
    code: NodeType::CreateGroup->name,
    name: '创建群聊',
    paramsConfig: CreateGroupNodeParamsConfig::class,
    version: 'v0',
    singleDebug: false,
    needInput: false,
    needOutput: false,
)]
class CreateGroupNodeRunner extends NodeRunner
{
    protected function run(VertexResult $vertexResult, ExecutionData $executionData, array $frontResults): void
    {
        /** @var CreateGroupNodeParamsConfig $paramsConfig */
        $paramsConfig = $this->node->getNodeParamsConfig();

        $groupName = $paramsConfig->getGroupName()->getValue()->getResult($executionData->getExpressionFieldData());
        if (! is_string($groupName) || trim($groupName) === '') {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'common.empty', ['label' => 'group_name']);
        }
        $vertexResult->addDebugLog('group_name', $groupName);

        $groupOwner = $paramsConfig->getGroupOwner()->getValue()->getResult($executionData->getExpressionFieldData());
        if (is_array($groupOwner) && (isset($groupOwner['id']) || isset($groupOwner['user_id']))) {
            $groupOwner = [$groupOwner];
        }
        if (! is_array($groupOwner) || empty($groupOwner[0])) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'common.empty', ['label' => 'group_owner']);
        }
        $groupOwnerId = $groupOwner[0]['id'] ?? ($groupOwner[0]['user_id'] ?? '');
        $vertexResult->addDebugLog('group_owner', $groupOwnerId);

        // 获取 owner 的用户信息
        $groupOwnerInfo = di(MagicUserDomainService::class)->getUserById($groupOwnerId);
        if (! $groupOwnerInfo) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'common.not_found', ['label' => 'group_owner']);
        }
        $vertexResult->addDebugLog('group_owner_magic_id', $groupOwnerInfo->getMagicId());

        // 群成员，全是用户 ID
        $groupMembers = $paramsConfig->getGroupMembers()?->getValue()->getResult($executionData->getExpressionFieldData());
        $groupMemberIds = [];
        foreach ($groupMembers as $groupMember) {
            $groupMemberId = $groupMember['id'] ?? ($groupMember['user_id'] ?? '');
            if (is_string($groupMemberId) && ! empty($groupMemberId)) {
                $groupMemberIds[] = $groupMemberId;
            }
        }

        $groupType = GroupTypeEnum::tryFrom($paramsConfig->getGroupType());
        if (! $groupType) {
            ExceptionBuilder::throw(FlowErrorCode::ExecuteFailed, 'common.invalid', ['label' => 'group_type']);
        }

        if ($paramsConfig->isIncludeCurrentUser()) {
            $groupMemberIds[] = $executionData->getOperator()->getUid();
        }
        $assistantOpeningSpeech = '';
        if ($paramsConfig->isIncludeCurrentAssistant()) {
            if ($agentUserId = $executionData->getAgentUserId()) {
                $groupMemberIds[] = $agentUserId;
                // 只有 assistant 开启，才会有开场白
                $assistantOpeningSpeech = $paramsConfig->getAssistantOpeningSpeech()?->getValue()->getResult($executionData->getExpressionFieldData()) ?? '';
            }
        }
        $groupMemberIds = array_values(array_filter(array_unique($groupMemberIds)));
        $vertexResult->addDebugLog('group_members', $groupMemberIds);
        $vertexResult->addDebugLog('assistant_opening_speech', $assistantOpeningSpeech);

        // 只有 IM 聊天才会创建
        if (! $executionData->getExecutionType()->isImChat()) {
            $magicGroup = [
                'group_id' => 'test_group_id',
                'name' => $groupName,
                'type' => $groupType->value,
            ];

            $vertexResult->setResult($magicGroup);
            return;
        }

        // 以 owner 的身份去创建
        $ownerAuthorization = new MagicUserAuthorization();
        $ownerAuthorization->setId($groupOwnerInfo->getUserId());
        $ownerAuthorization->setOrganizationCode($groupOwnerInfo->getOrganizationCode());
        $ownerAuthorization->setMagicId($groupOwnerInfo->getMagicId());
        $ownerAuthorization->setUserType($groupOwnerInfo->getUserType());

        $magicGroupDTO = new MagicGroupEntity();
        $magicGroupDTO->setGroupAvatar('');
        $magicGroupDTO->setGroupName($groupName);
        $magicGroupDTO->setGroupType($groupType);
        $magicGroupDTO->setGroupStatus(GroupStatusEnum::Normal);

        // 通过 会话ID 获取来源 和 助理 key，并创建群聊
        $agentKey = $executionData->getTriggerData()->getAgentKey();
        $this->createChatGroup($agentKey, $groupMemberIds, $ownerAuthorization, $magicGroupDTO);

        if (! empty($assistantOpeningSpeech)) {
            // 助手发送群聊消息
            $assistantMessage = new TextMessage(['content' => $assistantOpeningSpeech]);
            $appMessageId = IdGenerator::getUniqueId32();
            $receiveSeqDTO = new MagicSeqEntity();
            $receiveSeqDTO->setContent($assistantMessage);
            $receiveSeqDTO->setSeqType($assistantMessage->getMessageTypeEnum());

            $receiverId = $magicGroupDTO->getId();
            $senderUserId = $executionData->getAgentUserId();
            di(MagicChatMessageAppService::class)->agentSendMessage(
                aiSeqDTO: $receiveSeqDTO,
                senderUserId: $senderUserId,
                receiverId: $receiverId,
                appMessageId: $appMessageId,
                receiverType: ConversationType::Group
            );
        }
        $magicGroup = [
            'group_id' => $magicGroupDTO->getId(),
            'name' => $magicGroupDTO->getGroupName(),
            'type' => $magicGroupDTO->getGroupType()->value,
        ];

        $vertexResult->setResult($magicGroup);
    }

    private function createChatGroup(string $agentKey, array $groupMemberIds, MagicUserAuthorization $userAuthorization, MagicGroupEntity $magicGroupDTO): void
    {
        if (! empty($agentKey)) {
            di(MagicBotThirdPlatformChatAppService::class)->createChatGroup($agentKey, $groupMemberIds, $userAuthorization, $magicGroupDTO);
        } else {
            di(MagicChatGroupAppService::class)->createChatGroup($groupMemberIds, [], $userAuthorization, $magicGroupDTO);
        }
    }
}
