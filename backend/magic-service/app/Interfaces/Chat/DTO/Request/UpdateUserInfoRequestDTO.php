<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Chat\DTO\Request;

use App\Domain\Contact\DTO\UserUpdateDTO;
use App\Domain\Contact\Entity\ValueObject\UserPreferences;
use App\Infrastructure\Core\AbstractRequestDTO;
use Closure;
use Hyperf\HttpServer\Contract\RequestInterface;

class UpdateUserInfoRequestDTO extends AbstractRequestDTO
{
    protected ?string $avatarUrl = null;

    protected ?string $nickname = null;

    protected ?string $profession = null;

    protected ?string $channel = null;

    protected ?string $timezone = null;

    protected ?array $preferences = null;

    /**
     * @var array<string, bool>
     */
    protected array $presentFields = [];

    public static function fromRequest(RequestInterface $request): static
    {
        $dto = parent::fromRequest($request);
        $dto->setPresentFields(array_keys($request->all()));
        return $dto;
    }

    public static function getHyperfValidationRules(): array
    {
        return [
            'avatar_url' => 'sometimes|nullable|string|max:255',
            'nickname' => 'sometimes|nullable|string|max:64',
            'profession' => 'sometimes|nullable|string|max:64',
            'channel' => 'sometimes|nullable|string|max:64',
            'preferences' => 'sometimes|nullable|array',
            'preferences.show_follow_up_suggestions' => 'sometimes|boolean',
            'preferences.keep_used_follow_up_suggestions' => 'sometimes|boolean',
            'timezone' => [
                'sometimes',
                'nullable',
                'string',
                'max:64',
                static function (string $attribute, mixed $value, Closure $fail): void {
                    if ($value === null) {
                        return;
                    }
                    if (! is_string($value) || $value === '' || ! str_contains($value, '/')) {
                        $fail('timezone 必须是合法的 IANA 时区标识符');
                        return;
                    }
                    if (! in_array($value, timezone_identifiers_list(), true)) {
                        $fail('timezone 必须是合法的 IANA 时区标识符');
                    }
                },
            ],
        ];
    }

    public static function getHyperfValidationMessage(): array
    {
        return [
            'avatar_url.string' => '头像地址格式不正确',
            'avatar_url.max' => '头像地址长度不能超过255个字符',
            'nickname.string' => '昵称格式不正确',
            'nickname.max' => '昵称长度不能超过64个字符',
            'profession.string' => '职业身份格式不正确',
            'profession.max' => '职业身份长度不能超过64个字符',
            'channel.string' => '获知渠道格式不正确',
            'channel.max' => '获知渠道长度不能超过64个字符',
            'preferences.array' => '偏好设置格式不正确',
            'preferences.show_follow_up_suggestions.boolean' => '始终显示追问建议必须是布尔值',
            'preferences.keep_used_follow_up_suggestions.boolean' => '保留使用过的追问建议必须是布尔值',
            'timezone.string' => 'timezone 格式不正确',
            'timezone.max' => 'timezone 长度不能超过64个字符',
        ];
    }

    public function getAvatarUrl(): ?string
    {
        return $this->avatarUrl;
    }

    public function setAvatarUrl(?string $avatarUrl): void
    {
        $this->avatarUrl = $avatarUrl;
    }

    public function getNickname(): ?string
    {
        return $this->nickname;
    }

    public function setNickname(?string $nickname): void
    {
        $this->nickname = $nickname;
    }

    public function getProfession(): ?string
    {
        return $this->profession;
    }

    public function setProfession(?string $profession): void
    {
        $this->profession = $profession;
    }

    public function getChannel(): ?string
    {
        return $this->channel;
    }

    public function setChannel(?string $channel): void
    {
        $this->channel = $channel;
    }

    public function getTimezone(): ?string
    {
        return $this->timezone;
    }

    public function setTimezone(?string $timezone): void
    {
        $this->timezone = $timezone;
    }

    public function getPreferences(): ?array
    {
        return $this->preferences;
    }

    public function setPreferences(?array $preferences): void
    {
        $this->preferences = $preferences;
    }

    public function isFieldPresent(string $field): bool
    {
        return $this->presentFields[$field] ?? false;
    }

    public function toDomainDTO(): UserUpdateDTO
    {
        $dto = new UserUpdateDTO();

        if ($this->isFieldPresent('avatar_url')) {
            $dto->setAvatarUrl($this->getAvatarUrl());
        }
        if ($this->isFieldPresent('nickname')) {
            $dto->setNickname($this->getNickname());
        }
        if ($this->isFieldPresent('profession')) {
            $dto->setProfession($this->getProfession());
        }
        if ($this->isFieldPresent('channel')) {
            $dto->setChannel($this->getChannel());
        }
        if ($this->isFieldPresent('timezone')) {
            $dto->setTimezone($this->getTimezone());
        }
        if ($this->isFieldPresent('preferences')) {
            $preferences = $this->getPreferences();
            $dto->setPreferences($preferences !== null ? UserPreferences::fromArray($preferences) : null);
        }

        return $dto;
    }

    /**
     * @param array<int, string> $fields
     */
    private function setPresentFields(array $fields): void
    {
        $this->presentFields = array_fill_keys($fields, true);
    }
}
