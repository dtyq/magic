<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra;

use App\Infrastructure\Core\AbstractDTO;

class SuperAgent extends AbstractDTO
{
    /**
     * Mention related data for @ references.
     */
    protected ?array $mention;

    /**
     * Input mode: chat | plan (only effective in general mode, deprecated in new version).
     */
    protected ?string $inputMode;

    /**
     * Chat mode: normal | follow_up | interrupt.
     */
    protected ?string $chatMode;

    /**
     * Task pattern: general | dataAnalysis | ppt | report.
     */
    protected ?string $taskPattern;

    public function getMention(): ?array
    {
        return $this->mention ?? null;
    }

    public function setMention(?array $mention): void
    {
        $this->mention = $mention;
    }

    public function getInputMode(): ?string
    {
        return $this->inputMode ?? null;
    }

    public function setInputMode(?string $inputMode): void
    {
        $this->inputMode = $inputMode;
    }

    public function getChatMode(): ?string
    {
        return $this->chatMode ?? null;
    }

    public function setChatMode(?string $chatMode): void
    {
        $this->chatMode = $chatMode;
    }

    public function getTaskPattern(): ?string
    {
        return $this->taskPattern ?? null;
    }

    public function setTaskPattern(?string $taskPattern): void
    {
        $this->taskPattern = $taskPattern;
    }
}
