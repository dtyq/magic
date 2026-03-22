<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO;

use App\Infrastructure\Core\AbstractDTO;

class MentionSkillDTO extends AbstractDTO
{
    protected string $id = '';

    protected string $code = '';

    protected string $name = '';

    protected string $description = '';

    protected ?string $logo = null;

    protected string $mentionSource = '';

    public function __construct(array $data = [])
    {
        if (isset($data['id'])) {
            $this->id = (string) $data['id'];
        }
        if (isset($data['code'])) {
            $this->code = (string) $data['code'];
        }
        if (isset($data['name'])) {
            $this->name = (string) $data['name'];
        }
        if (isset($data['description'])) {
            $this->description = (string) $data['description'];
        }
        if (array_key_exists('logo', $data)) {
            $this->logo = $data['logo'] !== null ? (string) $data['logo'] : null;
        }
        if (isset($data['mention_source'])) {
            $this->mentionSource = (string) $data['mention_source'];
        }
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'logo' => $this->logo,
            'mention_source' => $this->mentionSource,
        ];
    }
}
