# Vector Deletion Node

## 1. Node Introduction
The Vector Deletion Node is a node used to remove specific knowledge segments from a knowledge base, helping you selectively remove knowledge content that is no longer needed. This node enables you to maintain the timeliness and accuracy of your knowledge base by removing outdated, incorrect, or redundant knowledge segments.

**Image Description:**

The Vector Deletion Node interface mainly consists of three parts: knowledge base selection area, metadata matching settings, and business ID area. From top to bottom, you can select the knowledge base to operate on, set deletion conditions including deletion by ID, deletion by keywords, and other methods.
![Vector Deletion Node](https://cdn.letsmagic.cn/static/img/Vector-deletion.png)

## Why Do We Need a Vector Deletion Node?
**During the use of vector knowledge bases, you may encounter the following situations requiring deletion of some knowledge over time:**
- Knowledge content has become outdated and needs cleaning up
- Wrong or irrelevant information was mistakenly imported and needs removal
- Knowledge base structure needs adjustment, requiring deletion of duplicate or redundant content
- Privacy or sensitive information needs to be removed from the knowledge base
- Knowledge base capacity is approaching limits, requiring deletion of low-value content

The Vector Deletion Node provides precise deletion capabilities, allowing selective removal of specific knowledge segments without affecting other knowledge content, maintaining knowledge base quality and performance.

## Application Scenarios
### Scenario 1: Content Update and Maintenance
When your business documents are updated, you can first delete old version knowledge segments, then import new version content, ensuring information in the knowledge base always remains current.
### Scenario 2: Error Content Correction
When incorrect information or inaccurate content is found in the knowledge base, you can use the Vector Deletion Node to precisely remove this content, avoiding impact on user experience.
### Scenario 3: Knowledge Base Reorganization and Sorting
When knowledge base reorganization or sorting is needed, you can first delete content of specific categories, then re-import a more organized knowledge structure.

## Node Parameter Description
### Input Parameters
|Parameter Name|Description|Required|Parameter Type|
|---|---|---|---|
|Select Knowledge Base|Select the knowledge base to operate on, through [Fixed Value or Expression], choose from knowledge bases already created in the system|Yes|Dropdown Selection|
|Deletion Method|When selecting "Delete by Business ID", delete specified knowledge base data by adding variables. When selecting "Delete by Condition", set filter conditions through expressions, such as keywords, time range, etc.|Yes|Choose One|

### Output Parameters
After successful execution of the Vector Deletion Node, content deletion is completed in the background, but no specific result data is directly output. After successful deletion, this content can be confirmed through vector search nodes.

## Usage Instructions
### Basic Configuration Steps
1. **Select Knowledge Base**:
    1. Choose different methods from dropdown menu
    2. Dynamically reference knowledge base from previous node or already created knowledge base using @
2. **Select Deletion Method**:
    1. If selecting "Delete by ID", enter IDs to delete in "Segment ID List" field, separate multiple IDs with commas
    2. If selecting "Delete by Condition", set filter conditions, such as segments containing specific keywords
3. **Connect Nodes**: Connect Vector Deletion Node with upstream nodes (providing deletion conditions) and downstream nodes (processing deletion results)

### Advanced Techniques
1. **Using Variables to Dynamically Specify IDs**: You can use output variables from upstream nodes as deletion conditions to achieve dynamic deletion. For example, filter out IDs that need deletion through "Code Execution" node, then pass to Vector Deletion Node.
2. **Batch Conditional Deletion**: When needing to clean up large amounts of data meeting specific conditions, you can use conditional deletion function combined with multiple condition combinations (such as time range + keywords) to improve efficiency.
3. **Using with Loop Nodes**: For complex deletion scenarios, you can combine with loop nodes to achieve batch-by-batch deletion, avoiding timeout issues from deleting too much data at once.

## Notes
### Deletion Operations Are Irreversible
Once deletion operation is executed, deleted knowledge segment data **cannot be recovered**. Therefore, before performing batch deletion, it is recommended to:
- Export relevant knowledge segments for backup
- Use small-scale testing to verify deletion condition accuracy
- Ensure deletion operation has clear business requirements

### Performance Impact
Large-scale deletion operations may affect system performance, please note:
- Avoid performing large deletion operations during business peak hours
- For large knowledge bases, it is recommended to delete in batches rather than all at once
- After deletion operation completes, knowledge base vector index needs some time to rebuild, during which query performance may be affected

### Permission Restrictions
Executing vector deletion operations requires corresponding permissions, please ensure:
- Workflow creator has management permissions for knowledge base
- Deletion operations comply with enterprise data management standards
- Deletion operations for critical knowledge bases should have appropriate approval processes

## Common Issues
### Deletion Operation Executes Successfully but Knowledge Base Query Results Not Updated
**Issue**: Deletion operation shows success, but deleted content can still be queried through vector search nodes.

**Solution**:
- Vector knowledge base index updates have some delay, usually requiring 1-5 minutes to complete index refresh
- If not updated for long time, try adding appropriate wait node after deletion node
- Check if duplicate content exists, ensure deletion conditions cover all content that needs deletion

### Timeout Error During Batch Deletion
**Issue**: When deleting large amounts of knowledge segments, node execution times out or reports errors.

**Solution**:
- Split large batch deletion into multiple small batch operations
- Use loop nodes to implement batch-by-batch deletion
- Increase node execution timeout setting (if this option exists)
- Choose times with lower system load to execute large batch deletions

### Unable to Delete Specific Knowledge Segments
**Issue**: Some knowledge segments cannot be deleted, even with correct IDs provided.

**Solution**:
- Check if knowledge segments have special protection markers
- Confirm if operating account has sufficient permissions
- Check if knowledge segment IDs are correct (note ID format and case sensitivity)
- Try using conditional deletion method as alternative solution

## Best Practices
### Common Node Combinations
|**Node Type**|**Combination Reason**|
|---|---|
|Vector Search Node|First confirm content to delete through vector search, then perform deletion|
|Code Execution Node|Used to handle complex deletion condition logic or format deletion ID lists|
|Conditional Branch Node|Determine subsequent process based on deletion results|
|Loop Node|Implement batch deletion of large amounts of data|
|Vector Storage Node|Store updated content after deleting old content|

<font color="#CE2B2E">Note: Although deletion operations are simple, they are irreversible. Please use with caution after fully understanding operation impact. Regular maintenance and updates of knowledge base will keep your intelligent applications in optimal state</font> 