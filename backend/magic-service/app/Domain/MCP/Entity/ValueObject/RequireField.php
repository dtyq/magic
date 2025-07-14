<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;

class RequireField extends AbstractValueObject
{
    protected string $fieldName = '';

    protected string $fieldValue = '';

    public function getFieldName(): string
    {
        return $this->fieldName;
    }

    public function setFieldName(string $fieldName): self
    {
        $this->fieldName = $fieldName;
        return $this;
    }

    public function getFieldValue(): string
    {
        return $this->fieldValue;
    }

    public function setFieldValue(string $fieldValue): self
    {
        $this->fieldValue = $fieldValue;
        return $this;
    }

    /**
     * Create from array representation.
     */
    public static function fromArray(array $data): ?self
    {
        $fieldName = $data['field_name'] ?? '';
        // Return null if field_name is empty
        if (empty($fieldName)) {
            return null;
        }

        $field = new self();
        $field->setFieldName($fieldName);
        $field->setFieldValue($data['field_value'] ?? '');
        return $field;
    }

    /**
     * Convert to array representation.
     */
    public function toArray(): array
    {
        return [
            'field_name' => $this->fieldName,
            'field_value' => $this->fieldValue,
        ];
    }

    /**
     * Check if field has non-empty value.
     */
    public function hasValue(): bool
    {
        return ! empty($this->fieldValue);
    }

    /**
     * Check if field name matches.
     */
    public function isField(string $fieldName): bool
    {
        return $this->fieldName === $fieldName;
    }
}
