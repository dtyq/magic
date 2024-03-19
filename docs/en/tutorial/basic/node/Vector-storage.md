# Vector Storage Node

## What is a Vector Storage Node?
The Vector Storage Node is a functional component in Magic Flow workflows used for storing text content in vector databases. It can convert text content into vector form and save it in knowledge bases, facilitating subsequent semantic retrieval and content matching. Simply put, vector storage is like an intelligent information warehouse that not only stores the content itself but also preserves the semantic features of the content, enabling subsequent queries through semantic similarity.

**Image Description:**

The vector storage node interface displays the main configuration areas of the node, including knowledge base selection, storage content input, metadata settings, and business ID configuration options.
![Vector Storage Node](https://cdn.letsmagic.cn/static/img/Vector-storage.png)

## Why Do We Need a Vector Storage Node?
**In building intelligent applications, the vector storage node solves the following key problems:**
- **Knowledge Accumulation**: Convert important information into retrievable knowledge, building enterprise-specific knowledge bases
- **Semantic Understanding**: Unlike traditional databases, vector storage preserves semantic information of content, supporting similarity retrieval
- **Information Organization**: Classify and manage stored content through metadata and business IDs
- **Custom Knowledge**: Provide exclusive knowledge support for large models, solving the problem of limited knowledge in general models
- **Intelligent Application Foundation**: Provide data foundation for intelligent applications like Q&A systems and recommendation systems

## Application Scenarios
### 1. Building Enterprise Knowledge Base
Store company documents, product manuals, operation guides, and other content in vector databases to form a retrievable enterprise knowledge system, helping employees quickly access needed information.
### 2. Intelligent Customer Service Knowledge Accumulation
Store common problem solutions, product information, service processes, and other content to provide knowledge support for intelligent customer service robots, improving customer service quality.
### 3. Personalized Content Management
Store user preferences, historical interaction records, and other information to provide data support for personalized recommendations and services, enhancing user experience.

## Node Parameter Description
### Basic Parameters
|Parameter Name|Description|Required|Default Value|
|---|---|---|---|
|Select Knowledge Base|Choose the knowledge base to operate on, through [Fixed Value or Expression], select from knowledge bases already created in the system|Yes|None|
|Storage Content|Text content to be stored in vector database|Yes|None|
|Business ID|Unique identifier for content, used for subsequent query or deletion operations|Yes|None|
|Metadata|Additional information about content, such as category, source, time, etc., for filtering|No|None|

### Output Content
After successful execution of the vector storage node, content storage is completed in the background, but no specific result data is directly output. After successful storage, this content can be retrieved through vector search node.

## Usage Instructions
### Basic Configuration Steps
1. **Select Knowledge Base**:
    1. Choose different methods from the dropdown menu
    2. Dynamically reference knowledge bases from previous nodes or already created knowledge bases using @
2. **Configure Storage Fragment**:
    1. Input text content to be stored
    2. Or use variable references for dynamic content, such as `{{message_content}}` to reference output from other nodes
3. **Set Business ID**:
    1. Input a unique business identifier
    2. Recommended to use meaningful identification methods, such as "Product_FAQ_001" or dynamically generated UUID
    3. Business ID is very important for subsequent content deletion or updates
4. **Configure Metadata (Optional)**:
    1. Add additional information like category, tags, source, etc.
    2. Metadata uses key-value pair format, such as "category: FAQ", "source: official website"
    3. Metadata can be used as filter conditions in vector search

### Advanced Techniques
#### Content Optimization
**To improve vector storage and subsequent retrieval effectiveness, it's recommended to appropriately optimize stored content:**
1. **Content Chunking Storage**:
    1. Split long text into smaller independent content chunks before storage
    2. Use text segmentation node to process long text before storage
    3. Recommended to control each content chunk between 500-1000 characters
2. **Content Quality Control**:
    1. Ensure stored content has clear semantics and accurate expression
    2. Remove useless format symbols and redundant content
    3. Appropriately add context information to improve understandability
3. **Metadata Design**:
    1. Design reasonable metadata structure for easy subsequent filtering
    2. Common metadata includes: category, source, time, etc.
    3. Use unified format and naming conventions

#### Collaboration with Other Nodes
**Vector storage node typically needs to be used in combination with other nodes:**
1. **With Text Segmentation Node**:
    1. First split long text into fragments suitable for storage
    2. Then loop to store each segmented fragment
    3. Maintain business ID relevance, such as using prefix + index number
2. **With Code Execution Node**:
    1. Use code execution node to generate unique business IDs
    2. Or process and format content and metadata to be stored
3. **With HTTP Request Node**:
    1. Get data from external interfaces
    2. Process and store in vector database

## Notes
### Business ID Design
**Business ID design directly affects subsequent content management efficiency:**
- Ensure business ID uniqueness to avoid overwriting existing content
- Use meaningful and easily recognizable ID naming methods for easy management
- Consider using prefix + category + sequence number naming method, such as "PRD_FAQ_001"
- If using random IDs, ensure to maintain the correspondence between IDs and content

### Content Format and Quality
**Stored content quality directly affects subsequent retrieval effectiveness:**
- Avoid storing too much irrelevant information, focus on core content
- Ensure unified text format, remove HTML tags and other format symbols
- For non-text content like tables and charts, convert to text description before storage
- Regularly update and maintain knowledge base content to keep information accurate and timely

### Security and Permissions
**Knowledge base data security needs special attention:**
- Avoid storing sensitive personal information or company secrets
- Set access permission markers through metadata
- Regularly audit knowledge base content to ensure compliance

## Common Issues
### Issue 1: Cannot find stored content through vector search. What to do?
**Solution**:
- Check if vector database ID matches, ensure search and storage use same vector database
- Confirm stored content quality, too short or meaningless content may be difficult to retrieve
- Adjust vector search node's similarity threshold, appropriately lower to get more results
- Check if search query text is semantically related to stored content

### Issue 2: How to update already stored content?
**Solution**:
- Use same business ID to store content again, will overwrite original content
- If need to completely delete and recreate, first use vector deletion node to delete, then store new content
- For partial updates, recommend using complete new content to overwrite old content, rather than updating only parts

### Issue 3: How to handle slow performance when storing large amounts of content?
**Solution**:
- Process large amounts of content in batches, avoid storing too much data at once
- Use loop node to store content in batches
- Optimize content size, only store necessary information
- Prepare content processing work in advance to reduce computation burden during storage

## Common Node Combinations
|Node Type|Combination Reason|
|---|---|
|Text Segmentation Node|Split long text into fragments suitable for storage|
|Code Execution Node|Process content, generate business IDs or metadata|
|Vector Search Node|Retrieve stored vector content|
|Vector Deletion Node|Delete vector content no longer needed|
|Loop Node|Batch process and store multiple content items| 