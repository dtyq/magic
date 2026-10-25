<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\DTO\Request;

final readonly class FileReferenceSelectorDTO
{
    private function __construct(
        public ?int $fileId = null,
        public ?string $userPath = null,
    ) {
    }

    public static function fromInput(mixed $input): self
    {
        if (! is_array($input)) {
            return new self();
        }
        // 富引用始终按 ID 查真实记录；ID 无效时不能退回同名路径。
        if (array_key_exists('file_id', $input)) {
            $id = $input['file_id'];
            if ((is_string($id) || is_int($id))
                && preg_match('/^[1-9][0-9]*$/D', (string) $id)
                && (string) (int) $id === (string) $id) {
                return new self(fileId: (int) $id);
            }
            return new self();
        }
        $path = $input['space_relative_path'] ?? null;
        if (($input['space_type'] ?? null) !== 'user' || ! is_string($path) || ! self::isValidPath($path)) {
            return new self();
        }
        return new self(userPath: rtrim($path, '/'));
    }

    public static function isValidPath(string $path): bool
    {
        if ($path === '' || str_starts_with($path, '/') || preg_match('/[\x00-\x1f\x7f]/', $path)) {
            return false;
        }
        foreach (explode('/', rtrim($path, '/')) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') {
                return false;
            }
        }
        return true;
    }

    public function key(): string
    {
        return $this->fileId !== null ? 'id:' . $this->fileId : 'user:' . $this->userPath;
    }

    public function isValid(): bool
    {
        return $this->fileId !== null || $this->userPath !== null;
    }
}
