<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity;

use App\Domain\Permission\Entity\ValueObject\BindingScopeType;
use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

class FunctionPermissionPolicyEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode = '';

    protected string $functionCode = '';

    protected bool $enabled = false;

    protected array $bindingScope = [
        'type' => BindingScopeType::OrganizationAll->value,
    ];

    protected ?string $remark = null;

    protected ?DateTime $createdAt = null;

    protected ?DateTime $updatedAt = null;

    public function shouldCreate(): bool
    {
        return empty($this->id);
    }

    public function prepareForCreation(): void
    {
        $this->validate();
        $this->createdAt ??= new DateTime();
        $this->updatedAt ??= $this->createdAt;
        $this->id = null;
    }

    public function prepareForModification(): void
    {
        $this->validate();
        $this->updatedAt = new DateTime();
    }

    public function validate(): void
    {
        if ($this->organizationCode === '') {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'organization_code is required');
        }

        if ($this->functionCode === '') {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'function_code is required');
        }

        $this->bindingScope = self::normalizeValidatedBindingScope($this->bindingScope);
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getFunctionCode(): string
    {
        return $this->functionCode;
    }

    public function setFunctionCode(string $functionCode): void
    {
        $this->functionCode = trim($functionCode);
    }

    public function getEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool|int|string $enabled): void
    {
        if (is_bool($enabled)) {
            $this->enabled = $enabled;
            return;
        }

        $this->enabled = in_array((string) $enabled, ['1', 'true', 'enabled'], true);
    }

    public function getBindingScope(): array
    {
        return $this->bindingScope;
    }

    public function setBindingScope(array $bindingScope): void
    {
        $this->bindingScope = $bindingScope;
    }

    public function getRemark(): ?string
    {
        return $this->remark;
    }

    public function setRemark(?string $remark): void
    {
        $this->remark = $remark === null ? null : trim($remark);
    }

    public function getCreatedAt(): ?DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): ?DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?DateTime $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public static function normalizeValidatedBindingScope(array $bindingScope): array
    {
        if ($bindingScope === []) {
            $bindingScope = [
                'type' => BindingScopeType::OrganizationAll->value,
            ];
        }

        $scopeType = (string) ($bindingScope['type'] ?? '');
        if ($scopeType === '') {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'binding_scope.type is required');
        }

        $scopeTypeEnum = BindingScopeType::tryFrom($scopeType);
        if ($scopeTypeEnum === null) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'binding_scope.type is invalid');
        }

        $userIds = self::normalizeStringArrayValue($bindingScope['user_ids'] ?? []);
        $departmentIds = self::normalizeStringArrayValue($bindingScope['department_ids'] ?? []);

        if ($scopeTypeEnum === BindingScopeType::OrganizationAll) {
            return [
                'type' => $scopeTypeEnum->value,
            ];
        }

        if ($userIds === [] && $departmentIds === []) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'binding_scope.user_ids or binding_scope.department_ids is required');
        }

        return [
            'type' => $scopeTypeEnum->value,
            'user_ids' => $userIds,
            'department_ids' => $departmentIds,
        ];
    }

    private static function normalizeStringArrayValue(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return array_values(array_unique(array_filter(array_map(static fn ($item): string => trim((string) $item), $value))));
    }
}
