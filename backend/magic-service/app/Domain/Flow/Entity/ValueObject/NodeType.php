<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject;

/**
 * 节点类型
 * 1 ~ 99 原子节点
 * 100 ~ 199 组合节点的硬编码实现.
 */
enum NodeType: int
{
    /*
     * Start Node
     * 用作触发器。窗口打开时、有新消息时、定时;参数调用（仅子流程可用）
     */
    case Start = 1;

    /*
     * LLM Chat 这里是历史原因的组合节点
     * 大语言模型 可选model、prompt、temperature
     */
    case LLM = 2;

    /*
     * Reply Message
     * 回复消息节点
     */
    case ReplyMessage = 3;

    /*
     * If
     * 条件判断节点
     */
    case If = 4;

    /*
     * Code
     * 代码执行节点
     */
    case Code = 5;

    /*
     * Vector
     * 文本转向量
     * 数据匹配
     * 向量数据存储
     */
    //    case Vector = 6;

    /*
     * 记忆
     * Short-term Memory
     * Long-term Memory
     */
    //    case Memory = 7;

    /*
     * Loader
     * 数据加载。来源：向量数据库、文件、网络
     */
    case Loader = 8;

    /*
     * 变量
     * set get
     */
    //    case Variable = 9;

    /*
     * Http
     * 接口请求
     */
    case Http = 10;

    /*
     * 子流程
     */
    case Sub = 11;

    /*
     * End Node
     * 结束节点
     */
    case End = 12;

    /*
     * History Message
     * 历史消息 查询
     */
    case HistoryMessage = 13;

    /*
     * 文本切割
     */
    case TextSplitter = 14;

    /*
     * 文本嵌入
     */
    case TextEmbedding = 15;

    /*
     * 向量存储 知识库片段
     */
    case KnowledgeFragmentStore = 16;

    /*
     * 知识相似度
     */
    case KnowledgeSimilarity = 17;

    /*
     * 缓存设置
     */
    case CacheSet = 18;

    /*
     * 缓存获取
     */
    case CacheGet = 19;

    /*
     * 历史消息存储
     */
    case HistoryMessageStore = 20;

    /*
     * 变量设置
     */
    case VariableSet = 21;

    /*
     * 变量数组shift
     */
    case VariableArrayShift = 22;

    /*
     * 变量数组push
     */
    case VariableArrayPush = 23;

    /*
     * 意图识别
     */
    case IntentRecognition = 24;

    /**
     * LLM Call.
     */
    case LLMCall = 25;

    /**
     * 工具节点.
     */
    case Tool = 26;

    /**
     * 知识库片段删除.
     */
    case KnowledgeFragmentRemove = 27;

    /**
     * 人员检索.
     */
    case UserSearch = 28;

    /**
     * 等待消息.
     */
    case WaitMessage = 29;

    /**
     * 循环节点.
     */
    case LoopMain = 30;

    /**
     * 循环节点体.
     */
    case LoopBody = 31;

    /**
     * 循环结束.
     */
    case LoopStop = 32;

    /**
     * Excel 文件加载器.
     */
    case ExcelLoader = 51;

    /**
     * 知识库 检索.
     */
    case KnowledgeSearch = 52;

    /**
     * 图像生成.
     */
    case ImageGenerate = 53;

    /**
     * 创建群聊.
     */
    case CreateGroup = 54;
}
