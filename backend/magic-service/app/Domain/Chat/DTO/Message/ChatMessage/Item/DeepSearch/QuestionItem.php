<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage\Item\DeepSearch;

use App\Infrastructure\Core\AbstractObject;

class QuestionItem extends AbstractObject
{
    /**
     * @var null|string 由某个问题引申出的问题。如果 parentQuestionId 为空(0)，则表示该关联问题是由用户输入的问题产生。
     */
    protected ?string $parentQuestionId = null;

    /**
     * 问题 id.
     */
    protected string $questionId;

    /**
     * 问题内容.
     */
    protected string $question;

    public function getParentQuestionId(): ?string
    {
        return $this->parentQuestionId;
    }

    public function setParentQuestionId(?string $parentQuestionId): void
    {
        $this->parentQuestionId = $parentQuestionId;
    }

    public function getQuestionId(): string
    {
        return $this->questionId;
    }

    public function setQuestionId(string $questionId): void
    {
        $this->questionId = $questionId;
    }

    public function getQuestion(): string
    {
        return $this->question;
    }

    public function setQuestion(string $question): void
    {
        $this->question = $question;
    }
}
