<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO;

class MentionSkillDTO
{
    public string $id = '';

    public string $code = '';

    public string $name = '';

    public string $description = '';

    public ?string $logo = null;

    public string $mentionSource = '';

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
}
