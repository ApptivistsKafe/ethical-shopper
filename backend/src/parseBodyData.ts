/**
 * Recursively parses a Reddit API response structure to extract all 'body' keys (comment content)
 * and flatten the structure. Leaf nodes (body-only) become simple strings, others remain objects.
 */
function parseBodyData(data: any): any {
  const result = parseBodyDataRecursive(data);
  return result ? flattenRedundantChildren(result) : null;
}

/**
 * Flattens redundant children blocks and converts leaf nodes to simple strings
 */
function flattenRedundantChildren(data: any): any {
  if (!data || typeof data !== "object") {
    return data;
  }

  // If this is an array, process each item
  if (Array.isArray(data)) {
    return data
      .map((item) => flattenRedundantChildren(item))
      .filter((item) => item !== null);
  }

  // Process the current object
  let result: any = {};
  let hasContent = false;

  // Copy body if it exists
  if (data.body && typeof data.body === "string") {
    result.body = data.body;
    hasContent = true;
  }

  // Process children
  if (data.children && Array.isArray(data.children)) {
    let processedChildren = data.children
      .map((child: any) => flattenRedundantChildren(child))
      .filter((child: any) => child !== null);

    // If there's only one child and this node has no body, flatten up
    if (processedChildren.length === 1 && !result.body) {
      return processedChildren[0];
    }

    // If there are multiple children or this node has a body, keep the structure
    if (processedChildren.length > 0) {
      result.children = processedChildren;
      hasContent = true;
    }
  }

  // NEW: If this node has only a body and no children, convert to simple string
  if (result.body && !result.children) {
    return result.body;
  }

  return hasContent ? result : null;
}

/**
 * Core recursive parsing function
 */
function parseBodyDataRecursive(data: any): any {
  // Handle null, undefined, or primitive values
  if (!data || typeof data !== "object") {
    return null;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    const children: any[] = [];
    for (const item of data) {
      const parsed = parseBodyDataRecursive(item);
      if (parsed) {
        children.push(parsed);
      }
    }
    return children.length > 0 ? { children } : null;
  }

  // Handle objects
  const result: any = {};
  let hasContent = false;

  // Look for 'body' key (the comment content)
  if (data.body && typeof data.body === "string") {
    result.body = data.body;
    hasContent = true;
  }

  // Recursively process all other keys to find nested content
  const children: any[] = [];
  for (const [key, value] of Object.entries(data)) {
    // Skip the 'body' key since we already processed it
    if (key === "body") continue;

    const parsed = parseBodyDataRecursive(value);
    if (parsed) {
      if (Array.isArray(parsed)) {
        // If parsed is an array, spread it into children
        children.push(...parsed);
      } else if (parsed.body) {
        // Only add to children if it has a body
        children.push(parsed);
      } else if (parsed.children && parsed.children.length > 0) {
        // If no body but has children, collapse and spread the children
        children.push(...parsed.children);
      }
    }
  }

  // Add children if we found any
  if (children.length > 0) {
    result.children = children;
    hasContent = true;
  }

  // Only return result if we found some content
  return hasContent ? result : null;
}

export default parseBodyData;
