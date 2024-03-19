<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Chat\V0;

use App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\NodeParamsConfig;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\FlowExprEngine\Component;
use Dtyq\FlowExprEngine\ComponentFactory;
use Dtyq\FlowExprEngine\Structure\StructureType;

class CreateGroupNodeParamsConfig extends NodeParamsConfig
{
    private Component $groupName;

    private Component $groupOwner;

    private ?Component $groupMembers = null;

    private int $groupType = 0;

    private bool $includeCurrentUser = true;

    private bool $includeCurrentAssistant = true;

    private ?Component $assistantOpeningSpeech = null;

    public function getGroupName(): Component
    {
        return $this->groupName;
    }

    public function getGroupOwner(): Component
    {
        return $this->groupOwner;
    }

    public function getGroupMembers(): ?Component
    {
        return $this->groupMembers;
    }

    public function getGroupType(): int
    {
        return $this->groupType;
    }

    public function isIncludeCurrentUser(): bool
    {
        return $this->includeCurrentUser;
    }

    public function isIncludeCurrentAssistant(): bool
    {
        return $this->includeCurrentAssistant;
    }

    public function getAssistantOpeningSpeech(): ?Component
    {
        return $this->assistantOpeningSpeech;
    }

    public function validate(): array
    {
        $params = $this->node->getParams();

        $groupName = ComponentFactory::fastCreate($params['group_name'] ?? []);
        if (! $groupName?->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'group_name']);
        }
        $this->groupName = $groupName;

        $groupOwner = ComponentFactory::fastCreate($params['group_owner'] ?? []);
        if (! $groupOwner?->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'group_owner']);
        }
        $this->groupOwner = $groupOwner;

        $groupMembers = ComponentFactory::fastCreate($params['group_members'] ?? []);
        if ($groupMembers && ! $groupMembers->isValue()) {
            ExceptionBuilder::throw(FlowErrorCode::FlowNodeValidateFailed, 'flow.component.format_error', ['label' => 'group_members']);
        }
        $this->groupMembers = $groupMembers;

        $this->groupType = (int) ($params['group_type'] ?? 0);
        $this->includeCurrentUser = (bool) ($params['include_current_user'] ?? true);
        $this->includeCurrentAssistant = (bool) ($params['include_current_assistant'] ?? true);
        $this->assistantOpeningSpeech = ComponentFactory::fastCreate($params['assistant_opening_speech'] ?? []);

        return [
            'group_name' => $this->groupName->toArray(),
            'group_owner' => $this->groupOwner->toArray(),
            'group_members' => $this->groupMembers?->toArray(),
            'group_type' => $this->groupType,
            'include_current_user' => $this->includeCurrentUser,
            'include_current_assistant' => $this->includeCurrentAssistant,
            'assistant' => $this->assistantOpeningSpeech?->toArray(),
        ];
    }

    public function generateTemplate(): void
    {
        $this->node->setParams([
            // 群名称
            'group_name' => ComponentFactory::generateTemplate(StructureType::Value)?->toArray(),
            // 群主
            'group_owner' => ComponentFactory::generateTemplate(StructureType::Value)?->toArray(),
            // 群成员
            'group_members' => ComponentFactory::generateTemplate(StructureType::Value)?->toArray(),
            // 群类型，此处对于 \App\Domain\Group\Entity\ValueObject\GroupTypeEnum
            'group_type' => 0,
            // 包含当前用户
            'include_current_user' => $this->includeCurrentUser,
            // 包含当前助理
            'include_current_assistant' => $this->includeCurrentAssistant,
            // 助理开场白
            'assistant_opening_speech' => ComponentFactory::generateTemplate(StructureType::Value)?->toArray(),
        ]);
    }
}
