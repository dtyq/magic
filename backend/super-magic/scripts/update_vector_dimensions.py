#!/usr/bin/env python
"""
更新现有向量集合的维度脚本

这个脚本用于更新现有向量集合的维度，以适应新的嵌入模型。
它将检查每个集合的向量维度，如果不匹配嵌入模型的维度，则会重新创建集合。
"""

import asyncio
import os
import sys

# 添加项目根目录到 Python 路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agentlang.config.config import config
from filebase.filebase_config import FilebaseConfig
from agentlang.llms.factory import LLMFactory
from qdrant_client import QdrantClient
from agentlang.logger import get_logger

logger = get_logger(__name__)


async def update_collection_dimensions():
    """检查并更新集合的向量维度"""
    # 获取 Qdrant 配置
    base_uri = config.get("qdrant.base_uri")
    api_key = config.get("qdrant.api_key")
    collection_prefix = config.get("qdrant.collection_prefix", "SUPERMAGIC-")
    filebase_prefix = config.get("qdrant.filebase_prefix", "SUPERMAGIC-FILEBASE-")

    if not base_uri:
        logger.error("Qdrant base URI not configured")
        return False

    # 初始化 Qdrant 客户端
    client = QdrantClient(url=base_uri, api_key=api_key or "")

    # 获取嵌入模型 ID 和维度
    embedding_model_id = FilebaseConfig.embedding_model_id
    embedding_dimension = LLMFactory.get_embedding_dimension(embedding_model_id)
    logger.info(f"使用嵌入模型 {embedding_model_id}，向量维度: {embedding_dimension}")

    # 获取所有集合
    try:
        collections = client.get_collections().collections
        logger.info(f"找到 {len(collections)} 个集合")
    except Exception as e:
        logger.error(f"获取集合列表失败: {str(e)}")
        return False

    # 检查每个集合
    for collection in collections:
        collection_name = collection.name
        
        # 仅处理 filebase 前缀的集合
        if not collection_name.startswith(filebase_prefix):
            logger.info(f"跳过非 filebase 集合: {collection_name}")
            continue
            
        logger.info(f"检查集合: {collection_name}")
        
        try:
            # 获取集合信息
            collection_info = client.get_collection(collection_name)
            current_vector_size = collection_info.config.params.vectors.size
            
            if current_vector_size != embedding_dimension:
                logger.warning(f"集合 {collection_name} 的向量维度 {current_vector_size} 与当前模型维度 {embedding_dimension} 不匹配")
                
                # 询问是否重建集合
                response = input(f"集合 {collection_name} 需要重建以适应新的向量维度 {embedding_dimension}。是否继续? (y/n): ")
                if response.lower() != 'y':
                    logger.info(f"跳过集合 {collection_name}")
                    continue
                
                logger.info(f"正在重建集合 {collection_name}...")
                
                # 删除旧集合
                client.delete_collection(collection_name)
                logger.info(f"已删除集合 {collection_name}")
                
                # 创建新集合
                from qdrant_client.http import models
                client.create_collection(
                    collection_name=collection_name,
                    vectors_config=models.VectorParams(
                        size=embedding_dimension,
                        distance=models.Distance.COSINE
                    )
                )
                logger.info(f"已创建新集合 {collection_name}，向量维度: {embedding_dimension}")
                
                # 提示用户需要重新索引文件
                logger.warning(f"集合 {collection_name} 已重建。需要重新索引相关文件！")
            else:
                logger.info(f"集合 {collection_name} 的向量维度 {current_vector_size} 已经正确")
        except Exception as e:
            logger.error(f"处理集合 {collection_name} 时出错: {str(e)}")
            continue

    logger.info("集合检查完成")
    return True


if __name__ == "__main__":
    asyncio.run(update_collection_dimensions()) 