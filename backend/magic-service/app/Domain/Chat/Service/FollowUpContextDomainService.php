<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Service;

use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskMessageRepositoryInterface;

readonly class FollowUpContextDomainService
{
    public function __construct(
        private TaskMessageRepositoryInterface $taskMessageRepository,
    ) {
    }

    public function buildFollowUpContextExcerptByTopicId(int $topicId, int $roundLimit = 3): string
    {
        if ($topicId <= 0) {
            return '';
        }

        $rows = $this->taskMessageRepository->findFollowUpContextRowsByTopicId($topicId, $roundLimit);
        if ($rows === []) {
            return '';
        }

        $lines = [];
        foreach ($rows as $row) {
            $content = $this->normalizeFollowUpContextText((string) ($row['content'] ?? ''));
            if ($content === '') {
                continue;
            }

            $displayTime = (string) ($row['display_time'] ?? '');
            $role = ($row['msg_role'] ?? '') === 'question' ? '问' : '答';
            $lines[] = sprintf('[%s] %s：%s', $displayTime, $role, $content);
        }

        return implode("\n", $lines);
    }

    private function normalizeFollowUpContextText(string $content): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', $content));
    }
}
