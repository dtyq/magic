<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\Directory;

use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\MentionDataInterface;
use App\Domain\Chat\DTO\Message\Common\MessageExtra\SuperAgent\Mention\NormalizePathTrait;
use App\Infrastructure\Core\AbstractDTO;

final class DirectoryData extends AbstractDTO implements MentionDataInterface
{
    use NormalizePathTrait;

    protected ?string $directoryPath;

    protected ?string $directoryName;

    protected ?array $directoryMetadata;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getDirectoryPath(): ?string
    {
        return $this->directoryPath ?? null;
    }

    public function getDirectoryName(): ?string
    {
        return $this->directoryName ?? null;
    }

    public function setDirectoryPath(string $directoryPath): void
    {
        $this->directoryPath = $directoryPath;
    }

    public function setDirectoryName(string $directoryName): void
    {
        $this->directoryName = $directoryName;
    }

    public function setDirectoryMetadata(?array $directoryMetadata): void
    {
        $this->directoryMetadata = $directoryMetadata;
    }

    public function getDirectoryMetadata(): ?array
    {
        return $this->directoryMetadata ?? null;
    }
}
