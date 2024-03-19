<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Comment\Service;

use App\Domain\Comment\Entity\CommentEntity;
use App\Domain\Comment\Entity\VO\GetCommentsWhereVo;
use App\Domain\Comment\Repository\CommentRepository;
use App\Infrastructure\Util\Context\RequestContext;

class CommentDomainService
{
    public function __construct(private CommentRepository $commentRepository)
    {
    }

    /**
     * 创建一个新的评论并维护相关的索引和附件。
     *
     * @param CommentEntity $commentEntity 评论实体
     * @return CommentEntity 创建后的评论实体
     */
    public function create(string $organizationCode, CommentEntity $commentEntity): CommentEntity
    {
        return $this->commentRepository->create($organizationCode, $commentEntity);
    }

    /**
     * 更新指定的评论内容和附件。
     *
     * @param RequestContext $requestContext 请求上下文
     * @param CommentEntity $commentEntity 要更新的评论实体
     */
    public function updateComment(
        RequestContext $requestContext,
        CommentEntity $commentEntity
    ): void {
        $this->commentRepository->updateComment($requestContext, $commentEntity);
    }

    /**
     * 根据条件获取评论列表。
     *
     * @param RequestContext $requestContext 请求上下文
     * @param GetCommentsWhereVo $whereVo 查询条件值对象
     * @return array<CommentEntity> 评论实体数组
     */
    public function getCommentsByConditions(
        RequestContext $requestContext,
        GetCommentsWhereVo $whereVo,
    ): array {
        return $this->commentRepository->getCommentsByConditions($requestContext, $whereVo);
    }

    /**
     * 根据评论ID数组获取对应的评论列表。
     *
     * @param RequestContext $requestContext 请求上下文
     * @param array $commentIds 评论ID数组
     * @return array<CommentEntity> 评论实体数组
     */
    public function getCommentsByIds(
        RequestContext $requestContext,
        array $commentIds
    ): array {
        return $this->commentRepository->getCommentsByIds($requestContext, $commentIds);
    }

    /**
     * 根据评论ID获取单个评论实体。
     *
     * @param RequestContext $requestContext 请求上下文
     * @param int $commentId 评论ID
     * @return ?CommentEntity 评论实体，如果不存在则返回null
     */
    public function getCommentById(
        RequestContext $requestContext,
        int $commentId,
    ): ?CommentEntity {
        return $this->commentRepository->getCommentById($requestContext, $commentId);
    }

    /**
     * 删除指定的评论。
     *
     * @param RequestContext $requestContext 请求上下文
     * @param int $commentId 评论ID
     * @return array 删除的评论ID数组
     */
    public function delete(RequestContext $requestContext, int $commentId): array
    {
        return $this->commentRepository->delete($requestContext, $commentId);
    }

    /**
     * 批量删除指定的评论及其所有子评论。
     *
     * @param RequestContext $requestContext 请求上下文
     * @param array $commentIds 要删除的评论ID数组
     * @return array 删除的评论ID数组
     */
    public function batchDelete(
        RequestContext $requestContext,
        array $commentIds
    ): array {
        return $this->commentRepository->batchDelete($requestContext, $commentIds);
    }

    /**
     * 批量恢复已删除的评论。
     *
     * @param RequestContext $requestContext 请求上下文
     * @param array $commentIds 要恢复的评论ID数组
     */
    public function batchRestore(
        RequestContext $requestContext,
        array $commentIds
    ): void {
        $this->commentRepository->batchRestore($requestContext, $commentIds);
    }

    /**
     * 根据资源ID获取所有相关的评论。
     *
     * @param int $resourceId 资源ID
     * @return array<CommentEntity> 评论实体数组
     */
    public function getCommentsByResourceId(string $organizationCode, int $resourceId): array
    {
        return $this->commentRepository->getCommentsByResourceId($organizationCode, $resourceId);
    }

    /**
     * 根据查询条件获取评论列表。
     *
     * @param RequestContext $requestContext 请求上下文
     * @param GetCommentsWhereVo $commentsWhereVo 查询条件值对象
     * @return array<CommentEntity> 评论实体数组
     */
    public function query(RequestContext $requestContext, GetCommentsWhereVo $commentsWhereVo): array
    {
        return $this->commentRepository->query($requestContext, $commentsWhereVo);
    }
}
