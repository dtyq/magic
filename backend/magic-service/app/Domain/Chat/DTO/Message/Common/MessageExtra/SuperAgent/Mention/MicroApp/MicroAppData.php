<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MicroApp;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionDataInterface;
use App\Infrastructure\Core\AbstractDTO;

final class MicroAppData extends AbstractDTO implements MentionDataInterface
{
    protected string $appId = '';

    protected string $appName = '';

    protected string $icon = '';

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getAppId(): string
    {
        return $this->appId;
    }

    public function setAppId(?string $appId): void
    {
        $this->appId = $appId ?? '';
    }

    public function getAppName(): string
    {
        return $this->appName;
    }

    public function setAppName(?string $appName): void
    {
        $this->appName = $appName ?? '';
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(?string $icon): void
    {
        $this->icon = $icon ?? '';
    }
}
