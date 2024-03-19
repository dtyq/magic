<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint\Conversation;

use Dtyq\EasyDingTalk\Kernel\Exceptions\BadRequestException;
use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidParameterException;
use Dtyq\EasyDingTalk\OpenDev\Api\Conversation\CreateGroupApi;
use Dtyq\EasyDingTalk\OpenDev\Api\Conversation\CreateSceneGroupApi;
use Dtyq\EasyDingTalk\OpenDev\Endpoint\OpenDevEndpoint;
use Dtyq\EasyDingTalk\OpenDev\Parameter\Conversation\CreateGroupParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\Conversation\CreateSceneGroupParameter;
use Dtyq\EasyDingTalk\OpenDev\Result\Conversation\CreateGroupResult;
use Dtyq\EasyDingTalk\OpenDev\Result\Conversation\CreateSceneGroupResult;
use GuzzleHttp\RequestOptions;

class ConversationEndpoint extends OpenDevEndpoint
{
    /**
     * 创建场景群.
     * @see https://open.dingtalk.com/document/orgapp/create-scene-group
     * @throws BadRequestException
     * @throws InvalidParameterException
     */
    public function createSceneGroup(CreateSceneGroupParameter $parameter): CreateSceneGroupResult
    {
        $parameter->validate();

        $api = new CreateSceneGroupApi();
        $api->setOptions([
            RequestOptions::QUERY => [
                'access_token' => $parameter->getAccessToken(),
            ],
            RequestOptions::JSON => [
                'title' => $parameter->getTitle(),
                'template_id' => $parameter->getTemplateId(),
                'owner_user_id' => $parameter->getOwnerUserId(),
                'user_ids' => $parameter->getUserIds(),
                'subadmin_ids' => $parameter->getSubadminIds(),
                'uuid' => $parameter->getUuid(),
                'icon' => $parameter->getIcon(),
                'mention_all_authority' => $parameter->getMentionAllAuthority(),
                'show_history_type' => $parameter->getShowHistoryType(),
                'validation_type' => $parameter->getValidationType(),
                'searchable' => $parameter->getSearchable(),
                'chat_banned_type' => $parameter->getChatBannedType(),
                'management_type' => $parameter->getManagementType(),
                'only_admin_can_ding' => $parameter->getOnlyAdminCanDing(),
                'all_members_can_create_mcs_conf' => $parameter->getAllMembersCanCreateMcsConf(),
                'all_members_can_create_calendar' => $parameter->getAllMembersCanCreateCalendar(),
                'group_email_disabled' => $parameter->getGroupEmailDisabled(),
                'only_admin_can_set_msg_top' => $parameter->getOnlyAdminCanSetMsgTop(),
                'add_friend_forbidden' => $parameter->getAddFriendForbidden(),
                'group_live_switch' => $parameter->getGroupLiveSwitch(),
                'members_to_admin_chat' => $parameter->getMembersToAdminChat(),
            ],
        ]);
        $result = $this->getResult($api);
        return ConversationFactory::createSceneGroupResultByRawData($result);
    }

    /**
     * 创建群组.
     * @see https://oapi.dingtalk.com/chat/create
     * @throws BadRequestException
     * @throws InvalidParameterException
     */
    public function createGroup(CreateGroupParameter $parameter): CreateGroupResult
    {
        $parameter->validate();

        $api = new CreateGroupApi();
        $api->setOptions([
            RequestOptions::QUERY => [
                'access_token' => $parameter->getAccessToken(),
            ],
            RequestOptions::JSON => [
                'name' => $parameter->getName(),
                'owner' => $parameter->getOwner(),
                'useridlist' => $parameter->getUseridlist(),
                'showHistoryType' => $parameter->getShowHistoryType(),
                'searchable' => $parameter->getSearchable(),
                'validationType' => $parameter->getValidationType(),
                'mentionAllAuthority' => $parameter->getMentionAllAuthority(),
                'managementType' => $parameter->getManagementType(),
                'chatBannedType' => $parameter->getChatBannedType(),
            ],
        ]);
        $result = $this->getResult($api);
        return ConversationFactory::createGroupResultByRawData($result);
    }
}
