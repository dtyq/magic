<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Persistence;

use App\Domain\Chat\Entity\MagicChatFileEntity;
use App\Domain\Chat\Repository\Facade\MagicChatFileRepositoryInterface;
use App\Domain\Chat\Repository\Persistence\Model\MagicChatFileModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Carbon\Carbon;
use Hyperf\DbConnection\Db;

class MagicChatFileRepository implements MagicChatFileRepositoryInterface
{
    public function __construct(
        protected MagicChatFileModel $magicChatFileModel
    ) {
    }

    public function uploadFile(MagicChatFileEntity $magicFileDTO): MagicChatFileEntity
    {
        if (empty($magicFileDTO->getFileId())) {
            $id = (string) IdGenerator::getSnowId();
            $magicFileDTO->setFileId($id);
        }
        $this->magicChatFileModel::query()->create($magicFileDTO->toArray());
        return $magicFileDTO;
    }

    public function uploadFiles(array $magicFileDTOs): array
    {
        $createData = [];
        $fileEntities = [];
        foreach ($magicFileDTOs as $magicFileDTO) {
            if (empty($magicFileDTO->getFileId())) {
                $id = (string) IdGenerator::getSnowId();
                $magicFileDTO->setFileId($id);
            }
            $createData[] = $magicFileDTO->toArray();
            $fileEntities[] = $magicFileDTO;
        }
        $this->magicChatFileModel::query()->insert($createData);
        return $fileEntities;
    }

    /**
     * @return MagicChatFileEntity[]
     */
    public function getChatFileByIds(array $fileIds, ?string $order = null, ?int $limit = null): array
    {
        if (empty($fileIds)) {
            return [];
        }
        $query = $this->magicChatFileModel::query()->whereIn('file_id', $fileIds);
        if (! is_null($order)) {
            $query->orderBy('created_at', $order);
        }
        if (! is_null($limit)) {
            $query->limit($limit);
        }
        $files = Db::select($query->toSql(), $query->getBindings());

        // Sort by fileIds order in PHP
        $fileMap = [];
        foreach ($files as $file) {
            $fileMap[$file['file_id']] = new MagicChatFileEntity($file);
        }

        $fileEntities = [];
        if (is_null($order)) {
            // If no order specified, return in fileIds order
            foreach ($fileIds as $fileId) {
                if (isset($fileMap[$fileId])) {
                    $fileEntities[] = $fileMap[$fileId];
                }
            }
        } else {
            // If order specified, return database sorted results
            $fileEntities = array_values($fileMap);
        }

        return $fileEntities;
    }

    /**
     * 通过file_key查找文件.
     */
    public function getChatFileByFileKey(string $fileKey): ?MagicChatFileEntity
    {
        $file = $this->magicChatFileModel::query()
            ->where('file_key', $fileKey)
            ->first();

        if (empty($file)) {
            return null;
        }

        return new MagicChatFileEntity($file->toArray());
    }

    /**
     * 更新文件信息.
     */
    public function updateFile(MagicChatFileEntity $fileEntity): void
    {
        $this->magicChatFileModel->newQuery()
            ->where('file_id', $fileEntity->getFileId())
            ->update([
                'file_type' => $fileEntity->getFileType(),
                'file_size' => $fileEntity->getFileSize(),
                'file_key' => $fileEntity->getFileKey(),
                'file_name' => $fileEntity->getFileName(),
                'file_extension' => $fileEntity->getFileExtension(),
                'updated_at' => Carbon::now(),
            ]);
    }

    public function updateFileById(string $fileId, MagicChatFileEntity $entity)
    {
        // 文件更新需谨慎，暂时只允许更新file_name
        $model = new MagicChatFileModel();
        $updateData = [];
        if ($entity->getFileKey()) {
            $updateData['file_key'] = $entity->getFileKey();
        }
        $updateData['updated_at'] = date('Y-m-d H:i:s');
        $model->query()->where('file_id', $fileId)->update($updateData);
    }
}
