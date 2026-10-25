<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\File\MagicFS\DTO\Request;

use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * Request DTO for POST /api/v1/open-api/magicfs/files/{id}/rename.
 *
 * Rename is its own endpoint instead of a partial update of the source row.
 * The reason is that a rename carries an identity decision the update endpoint
 * cannot express: when the destination name is already taken, whose row
 * survives? Encoded as an update, that answer had to be inferred from which
 * fields happened to be non-null, so callers had no way to ask for "fail
 * instead of replace" and the service had no way to say what it did.
 *
 * `on_exists` makes the policy explicit. It is a free-standing parameter rather
 * than a boolean because a third policy (e.g. "suffix the name") would then be
 * an additive change instead of a breaking one, and because `absorb`-style
 * boolean flags name an implementation instead of a decision.
 */
class RenameFileRequestDTO
{
    /**
     * Destination name. Required.
     */
    public string $new_name = '';

    /**
     * Destination parent directory id. Empty means "keep the current parent",
     * i.e. a pure rename.
     */
    public ?string $new_parent_id = null;

    /**
     * Collision policy: `replace` (POSIX rename(2) default) or `fail`.
     *
     * Left null when the caller omitted it so the domain layer — not the
     * transport — owns the default. That keeps the default in one place when
     * the endpoint gains another caller.
     */
    public ?string $on_exists = null;

    /** @var array<string, mixed> Per-request context (user/trace/authorization/...) */
    public array $message_metadata = [];

    public static function fromRequest(RequestInterface $request): self
    {
        $data = $request->all();

        $dto = new self();
        $dto->new_name = trim((string) ($data['new_name'] ?? ''));

        if (isset($data['new_parent_id']) && $data['new_parent_id'] !== '') {
            $dto->new_parent_id = (string) $data['new_parent_id'];
        }

        if (isset($data['on_exists'])) {
            $dto->on_exists = trim((string) $data['on_exists']);
        }

        $dto->message_metadata = $data['message_metadata'] ?? [];

        return $dto;
    }
}
