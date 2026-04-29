# GSE 字典来源说明

- 上游来源：`github.com/go-ego/gse v1.0.2`
- 目录用途：Go retrieval 运行时离线加载中文分词、停用词和预留的 IDF/TF-IDF 词典

## 文件说明

- `s_1.txt`：上游简体中文主词典，GSE 分词核心 serving 词典
- `t_1.txt`：上游繁体中文主词典，GSE 分词核心 serving 词典
- `custom_terms.txt`：仓库自维护领域词典；当前默认留空，避免在没有业务语料校验时预置人工词条
- `retrieval_stopwords.txt`：retrieval 使用的停用词基线文件；当前内容直接复制自上游 `stop_word.txt`，仅用于 sparse / lexical / rerank token 清洗
- `stop_tokens.txt`：上游停用 token 词典，预留给后续显式 stop-token 能力
- `stop_word.txt`：上游停用词词典，预留给后续显式 stopword / tf-idf / bm25 能力
- `idf.txt`：上游 IDF 词典，预留给后续离线 IDF 评测
- `tf_idf.txt`：上游 TF-IDF 词典，预留给后续离线 TF-IDF / BM25 评测
- `tf_idf_origin.txt`：上游原始 TF-IDF 词典，预留给后续离线回归与对比

## 刷新步骤

1. 在 `backend/magic-service/go-engine` 确认 `go.mod` 里的 `github.com/go-ego/gse` 版本。
2. 从本地模块缓存复制上游文件：
   - `$(go env GOMODCACHE)/github.com/go-ego/gse@<version>/data/dict/zh/stop_tokens.txt`
   - `$(go env GOMODCACHE)/github.com/go-ego/gse@<version>/data/dict/zh/stop_word.txt`
   - `$(go env GOMODCACHE)/github.com/go-ego/gse@<version>/data/dict/zh/idf.txt`
   - `$(go env GOMODCACHE)/github.com/go-ego/gse@<version>/data/dict/zh/tf_idf.txt`
   - `$(go env GOMODCACHE)/github.com/go-ego/gse@<version>/data/dict/zh/tf_idf_origin.txt`
3. 谨慎评估并更新仓库自维护文件：
   - `custom_terms.txt`：只允许基于真实业务语料与回归样本追加词条
   - `retrieval_stopwords.txt`：默认保持与上游 `stop_word.txt` 一致，确有检索收益时再做差异化维护
4. 执行 retrieval warmup / 单测，确认核心 serving 词典可加载。

## 校验方式

- warmup 通过，且不会回退到 `GOMODCACHE` 或 GSE 默认路径
- retrieval offline dict self-check 通过：核心词典存在、可切词、停用词过滤生效
- 相关单测通过：
  - 词典解析 / warmup
  - sparse query enrichment
  - sparse input / rerank token 清洗
