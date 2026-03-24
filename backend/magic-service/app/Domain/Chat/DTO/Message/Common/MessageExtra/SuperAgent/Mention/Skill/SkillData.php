<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Skill;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionDataInterface;
use App\Infrastructure\Core\AbstractDTO;

final class SkillData extends AbstractDTO implements MentionDataInterface
{
    protected string $id;

    protected string $code;

    protected string $name;

    protected string $icon;

    protected string $description;

    protected string $sourceType;

    protected ?string $mentionSource = null;

    protected bool $needUpgrade = false;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getId(): ?string
    {
        return $this->id ?? null;
    }

    public function setId(string $id): void
    {
        $this->id = $id;
    }

    public function getCode(): ?string
    {
        return $this->code ?? null;
    }

    public function setCode(string $code): void
    {
        $this->code = $code;
    }

    public function getName(): ?string
    {
        return $this->name ?? null;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getIcon(): ?string
    {
        return $this->icon ?? null;
    }

    public function setIcon(string $icon): void
    {
        $this->icon = $icon;
    }

    public function getDescription(): ?string
    {
        return $this->description ?? null;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    public function getSourceType(): ?string
    {
        return $this->sourceType ?? null;
    }

    public function setSourceType(string $sourceType): void
    {
        $this->sourceType = $sourceType;
        if ($this->mentionSource === null) {
            $this->mentionSource = $sourceType;
        }
    }

    public function getMentionSource(): ?string
    {
        return $this->mentionSource ?? $this->sourceType ?? null;
    }

    /**
     * Alias field for frontend payload key "mention_source".
     */
    public function setMentionSource(?string $mentionSource): void
    {
        $this->mentionSource = $mentionSource;
        if (! empty($mentionSource)) {
            $this->sourceType = $mentionSource;
        }
    }

    public function isNeedUpgrade(): bool
    {
        return $this->needUpgrade;
    }

    public function setNeedUpgrade(bool $needUpgrade): void
    {
        $this->needUpgrade = $needUpgrade;
    }
}
