<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class InitSandboxRequestDTO extends AbstractRequestDTO
{
    protected string $taskType = '';

    protected string $agentName = '';

    protected string $toolName = '';

    protected string $customName = '';

    protected string $modelId = '';

    protected string $workspaceId = '';

    protected string $projectId = '';

    protected string $projectMode = 'general';

    protected string $topicId = '';

    protected string $topicMode = '';

    protected string $prompt = '';

    protected ?string $params = null;

    protected string $accessToken = '';

    protected string $conversationId = '';

    /**
     * 验证规则.
     */
    public static function getHyperfValidationRules(): array
    {
        return [
            'task_type' => 'required|string', // 任务类型，支持agent、tool、custom三种模式
            // 'agent_name' => 'required_if:task_type,agent|string',//如果是agent模式，则需要传入agent_name
            // 'tool_name' => 'required_if:task_type,tool|string',//如果是tool模式，则需要传入tool_name
            // 'custom_name' => 'required_if:task_type,custom|string',//如果是custom模式，则需要传入custom_name
            'model_id' => 'string', // 模型ID
            'workspace_id' => 'string', // 工作区ID
            'project_id' => 'string', // 项目ID
            'project_mode' => 'string', // 项目模式
            'topic_id' => 'string', // 话题ID
            'topic_mode' => 'string', // 话题模式
            // 'prompt' => 'required_if:task_type,agent|string',//任务提示词,如果是agent模式，则需要传入prompt
            'params' => 'object', // 自定入params
        ];
    }

    public static function getHyperfValidationMessage(): array
    {
        return [
            'task_type.required' => '任务类型不能为空',
            // 'agent_name.required_if' => 'agent名称不能为空',
            // 'tool_name.required_if' => 'tool名称不能为空',
            // 'custom_name.required_if' => 'custom名称不能为空',
            'model_id.string' => '模型ID不能为空',
            'workspace_id.integer' => '工作区ID不能为空',
            'project_id.integer' => '项目ID不能为空',
            'project_mode.string' => '项目模式不能为空',
            'topic_id.integer' => '话题ID不能为空',
            'topic_mode.string' => '话题模式不能为空',
            'prompt.required_if' => '提示词不能为空',
            'params.object' => '参数不能为空',
        ];
    }

    /**
     * 属性名称.
     */
    public function attributes(): array
    {
        return [
            'task_type' => '任务类型',
            'agent_name' => 'agent名称',
            'tool_name' => 'tool名称',
            'custom_name' => 'custom名称',
            'model_id' => '模型ID',
            'workspace_id' => '工作区ID',
            'project_id' => '项目ID',
            'project_mode' => '项目模式',
            'topic_mode' => '话题模式',
            'topic_id' => '话题ID',
            'prompt' => '提示词',
            'params' => '参数',
        ];
    }

    public function getTaskType(): string
    {
        return $this->taskType;
    }

    public function getAgentName(): string
    {
        return $this->agentName;
    }

    public function getToolName(): string
    {
        return $this->toolName;
    }

    public function getCustomName(): string
    {
        return $this->customName;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function getWorkspaceId(): string
    {
        return $this->workspaceId;
    }

    public function setWorkspaceId(string $workspaceId): void
    {
        $this->workspaceId = $workspaceId;
    }

    public function getProjectId(): string
    {
        return $this->projectId;
    }

    public function setProjectId(string $projectId): void
    {
        $this->projectId = $projectId;
    }

    public function getProjectMode(): string
    {
        return $this->projectMode;
    }

    public function setProjectMode(string $projectMode): void
    {
        $this->projectMode = $projectMode;
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function setTopicId(string $topicId): void
    {
        $this->topicId = $topicId;
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function setConversationId(string $conversationId): void
    {
        $this->conversationId = $conversationId;
    }

    public function getTopicMode(): string
    {
        return $this->topicMode;
    }

    public function setTopicMode(string $topicMode): void
    {
        $this->topicMode = $topicMode;
    }

    public function getPrompt(): string
    {
        return $this->prompt;
    }

    public function getParams(): ?string
    {
        return $this->params;
    }

    public function setAccessToken(string $accessToken): void
    {
        $this->accessToken = $accessToken;
    }

    public function getAccessToken(): string
    {
        return $this->accessToken;
    }

    /*
     * 准备数据.
     */
    // protected function prepareForValidation(): void
    // {
    //     $this->taskType = (string) $this->input('task_type', '');
    //     $this->agentName = (string) $this->input('agent_name', '');
    //     $this->toolName = (string) $this->input('tool_name', '');
    //     $this->customName = (string) $this->input('custom_name', '');
    //     $this->modelId = (string) $this->input('model_id', '');
    //     $this->workspaceId = (int) $this->input('workspace_id', 0);
    //     $this->projectId = (int) $this->input('project_id', 0);
    //     $this->topicId = (int) $this->input('topic_id', 0);
    //     $this->prompt = (string) $this->input('prompt', '');
    //     $this->params = $this->has('params') ? (string) $this->input('params') : null;
    // }
}
