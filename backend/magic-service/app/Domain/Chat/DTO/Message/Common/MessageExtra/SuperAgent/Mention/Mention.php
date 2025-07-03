<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention;

use App\Infrastructure\Core\AbstractDTO;

class Mention extends AbstractDTO
{
    /**
     * Mention type.
     */
    protected string $type = MentionType::BASE_TYPE;

    /**
     * Mention attributes object.
     */
    protected ?MentionAttrs $attrs = null;

    public function __construct(?array $data = null)
    {
        if ($data) {
            if (isset($data['attrs'])) {
                $this->setAttrs($data['attrs']);
                unset($data['attrs']);
            }
        }
        parent::__construct($data);
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): void
    {
        $this->type = $type;
    }

    public function getAttrs(): ?MentionAttrs
    {
        return $this->attrs;
    }

    public function setAttrs(null|array|MentionAttrs $attrs): void
    {
        if (is_array($attrs)) {
            $this->attrs = new MentionAttrs($attrs);
        } else {
            $this->attrs = $attrs;
        }
    }

    /**
     * Get the attribute type.
     */
    public function getAttrsType(): ?MentionType
    {
        return $this->attrs?->getType();
    }

    /**
     * Get the attribute data object.
     */
    public function getAttrsData(): ?MentionData
    {
        return $this->attrs?->getData();
    }

    /**
     * Set the attribute data object.
     */
    public function setAttrsData(array|MentionData $data): void
    {
        if ($this->attrs === null) {
            $this->attrs = new MentionAttrs();
        }
        $this->attrs->setData($data);
    }

    /**
     * Set the attribute type.
     */
    public function setAttrsType(MentionType|string $type): void
    {
        if ($this->attrs === null) {
            $this->attrs = new MentionAttrs();
        }
        $this->attrs->setType($type);
    }

    /**
     * Check if it is a project file type.
     */
    public function isProjectFile(): bool
    {
        return $this->attrs?->getType() === MentionType::PROJECT_FILE;
    }

    /**
     * Check if it is an agent type.
     */
    public function isAgent(): bool
    {
        return $this->attrs?->getType() === MentionType::AGENT;
    }
}
