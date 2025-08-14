<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class CreateAgentTaskRequestDTO extends AbstractRequestDTO
{
    protected string $topicId = '';

    protected string $prompt = '';

    protected string $accessToken = '';

    protected string $conversationId = '';

    /**
     * 验证规则.
     */
    public static function getHyperfValidationRules(): array
    {
        return [
            'topic_id' => 'string',
            'prompt' => 'required|string',
        ];
    }

    public static function getHyperfValidationMessage(): array
    {
        return [
            'topic_id.string' => '话题ID不能为空',
            'prompt.required' => '任务提示词不能为空',
        ];
    }

    /**
     * 属性名称.
     */
    public function attributes(): array
    {
        return [
            'topic_id' => '话题ID',
            'prompt' => '任务提示词',
        ];
    }

    public function getTopicId(): string
    {
        return $this->topicId;
    }

    public function getConversationId(): string
    {
        return $this->conversationId;
    }

    public function setConversationId(string $conversationId): void
    {
        $this->conversationId = $conversationId;
    }

    public function getPrompt(): string
    {
        return $this->prompt;
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
