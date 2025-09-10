/**
 * Recursively parses a data structure to extract all 'text' keys (body content)
 * and flatten the structure to {body: <text>, children: <children with same structure>}
 */
function parseBodyData(data: any): any {
  // Handle null, undefined, or primitive values
  if (!data || typeof data !== 'object') {
    return null;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    const children: any[] = [];
    for (const item of data) {
      const parsed = parseBodyData(item);
      if (parsed) {
        children.push(parsed);
      }
    }
    return children.length > 0 ? { children } : null;
  }

  // Handle objects
  const result: any = {};
  let hasContent = false;

  // Look for 'text' key (the body content)
  if (data.text && typeof data.text === 'string') {
    result.body = data.text;
    hasContent = true;
  }

  // Recursively process all other keys to find nested content
  const children: any[] = [];
  for (const [key, value] of Object.entries(data)) {
    // Skip the 'text' key since we already processed it
    if (key === 'text') continue;

    const parsed = parseBodyData(value);
    if (parsed) {
      if (Array.isArray(parsed)) {
        // If parsed is an array, spread it into children
        children.push(...parsed);
      } else {
        children.push(parsed);
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
