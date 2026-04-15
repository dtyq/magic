<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Port;

use App\Application\KnowledgeBase\DTO\DocumentRequestDTO;

interface DocumentGateway
{
    public function create(DocumentRequestDTO $request): array;

    public function update(DocumentRequestDTO $request): array;

    public function show(DocumentRequestDTO $request): array;

    public function getOriginalFileLink(DocumentRequestDTO $request): array;

    public function list(DocumentRequestDTO $request): array;

    public function getByThirdFileId(DocumentRequestDTO $request): array;

    public function destroy(DocumentRequestDTO $request): bool;

    public function sync(DocumentRequestDTO $request): bool;

    public function reVectorizedByThirdFileId(DocumentRequestDTO $request): bool;

    /**
     * @return array<string, int>
     */
    public function countByKnowledgeBaseCodes(DocumentRequestDTO $request): array;
}
