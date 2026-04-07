<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Entity\ValueObject;

/**
 * follow-up 提示词中单行上下文（用户问 / 助手答），供合并排序后拼 PROMPT.
 */
readonly class FollowUpContextLine
{
    public function __construct(
        public int $sortTs,
        public int $sourceId,
        public string $displayTime,
        public string $content,
        public bool $isQuestion,
    ) {
    }

    public static function compare(self $a, self $b): int
    {
        if ($a->sortTs !== $b->sortTs) {
            return $a->sortTs <=> $b->sortTs;
        }

        return $a->sourceId <=> $b->sourceId;
    }

    public function toPromptLine(): string
    {
        $role = $this->isQuestion ? '问' : '答';

        return sprintf('[%s] %s：%s', $this->displayTime, $role, $this->content);
    }
}
