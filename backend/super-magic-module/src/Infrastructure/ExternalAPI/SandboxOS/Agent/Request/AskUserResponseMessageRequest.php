<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\AskUserResponseStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageType;

/**
 * Human-in-the-Loop 答复请求类.
 *
 * 用于将用户对 ask_user 问题的答复透传给沙盒，恢复暂停中的任务。
 * type 固定为 ask_user_response，answer/responseStatus/questionId 通过 dynamicConfig 传递。
 */
class AskUserResponseMessageRequest extends ChatMessageRequest
{
    public function __construct(
        string $messageId = '',
        string $userId = '',
        string $taskId = '',
        private string $questionId = '',
        private string $responseStatus = AskUserResponseStatus::Answered->value,
        private string $answer = '',
    ) {
        parent::__construct(
            messageId: $messageId,
            userId: $userId,
            taskId: $taskId,
            prompt: '',
            type: MessageType::AskUserResponse->value,
        );

        $this->syncDynamicConfig();
    }

    public static function createResponse(
        string $userId,
        string $taskId,
        string $questionId,
        string $responseStatus,
        string $answer,
    ): self {
        return new self(
            messageId: (string) IdGenerator::getSnowId(),
            userId: $userId,
            taskId: $taskId,
            questionId: $questionId,
            responseStatus: $responseStatus,
            answer: $answer,
        );
    }

    public function getQuestionId(): string
    {
        return $this->questionId;
    }

    public function setQuestionId(string $questionId): self
    {
        $this->questionId = $questionId;
        $this->syncDynamicConfig();
        return $this;
    }

    public function getResponseStatus(): string
    {
        return $this->responseStatus;
    }

    public function setResponseStatus(string $responseStatus): self
    {
        $this->responseStatus = $responseStatus;
        $this->syncDynamicConfig();
        return $this;
    }

    public function getAnswer(): string
    {
        return $this->answer;
    }

    public function setAnswer(string $answer): self
    {
        $this->answer = $answer;
        $this->syncDynamicConfig();
        return $this;
    }

    private function syncDynamicConfig(): void
    {
        $this->setDynamicConfig([
            'question_id' => $this->questionId,
            'response_status' => $this->responseStatus,
            'answer' => $this->answer,
        ]);
    }
}
