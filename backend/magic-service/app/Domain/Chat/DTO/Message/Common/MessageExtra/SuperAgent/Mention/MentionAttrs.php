<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention;

use App\Infrastructure\Core\AbstractDTO;
use InvalidArgumentException;

class MentionAttrs extends AbstractDTO
{
    /**
     * Attribute type enum.
     */
    protected MentionType $type;

    /**
     * Attribute data object.
     */
    protected MentionData $data;

    public function __construct(?array $data = null)
    {
        if ($data) {
            if (isset($data['type'])) {
                $this->setType($data['type']);
                unset($data['type']);
            }

            if (isset($data['data'])) {
                $this->setData($data['data']);
                unset($data['data']);
            } elseif (isset($this->type)) {
                // If type is set but data is not, create an empty data object.
                $this->data = MentionDataFactory::create($this->type->value, []);
            }
        }

        parent::__construct($data);
    }

    public function getType(): MentionType
    {
        return $this->type;
    }

    public function setType(MentionType|string $type): void
    {
        if (is_string($type)) {
            $this->type = MentionType::fromString($type);
        } else {
            $this->type = $type;
        }

        // When the type changes, recreate the data object if it already exists, otherwise create an empty one.
        if (isset($this->data)) {
            $oldData = $this->data->toArray();
            $this->data = MentionDataFactory::create($this->type->value, $oldData);
        } else {
            $this->data = MentionDataFactory::create($this->type->value, []);
        }
    }

    public function getData(): MentionData
    {
        return $this->data;
    }

    public function setData(array|MentionData $data): void
    {
        if (is_array($data)) {
            // If a type is available, create a data object based on it.
            if (isset($this->type)) {
                $this->data = MentionDataFactory::create($this->type->value, $data);
            } else {
                throw new InvalidArgumentException('Type must be set before setting data from array');
            }
        } else {
            $this->data = $data;
            $this->type = MentionType::fromString($data->getDataType());
        }
    }
}
