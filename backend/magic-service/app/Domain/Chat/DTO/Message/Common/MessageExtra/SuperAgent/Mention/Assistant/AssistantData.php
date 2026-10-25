<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Assistant;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionDataInterface;
use App\Infrastructure\Core\AbstractDTO;

final class AssistantData extends AbstractDTO implements MentionDataInterface
{
    protected string $assistantId;

    protected string $assistantName;

    protected string $assistantIcon;

    protected string $assistantDescription;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getAssistantId(): ?string
    {
        return $this->assistantId ?? null;
    }

    public function getAssistantName(): ?string
    {
        return $this->assistantName ?? null;
    }

    public function getAssistantIcon(): ?string
    {
        return $this->assistantIcon ?? null;
    }

    public function getAssistantDescription(): ?string
    {
        return $this->assistantDescription ?? null;
    }
}
