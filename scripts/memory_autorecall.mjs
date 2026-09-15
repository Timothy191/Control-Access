#!/usr/bin/env node
/**
 * Memory MCP Auto-Recall Engine for Control-Access
 * Automatically recalls knowledge graph entities for all 8 specialized agents
 * backed by ~/.gemini/memory.jsonl
 */

import { promises as fs } from 'fs';

const MEMORY_FILE = process.env.MEMORY_FILE_PATH || '/home/server/.gemini/memory.jsonl';

export async function autorecall(query = 'all') {
  try {
    const content = await fs.readFile(MEMORY_FILE, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);

    const graph = lines.reduce(
      (acc, line) => {
        try {
          const item = JSON.parse(line);
          if (item.type === 'entity') acc.entities.push(item);
          else if (item.type === 'relation') acc.relations.push(item);
        } catch {
          // ignore malformed lines
        }
        return acc;
      },
      { entities: [], relations: [] }
    );

    if (query === 'all') {
      return graph;
    }

    const q = query.toLowerCase();
    const matched = graph.entities.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.entityType.toLowerCase().includes(q) ||
        (e.observations && e.observations.some((obs) => obs.toLowerCase().includes(q)))
    );

    return matched;
  } catch (err) {
    console.error('Memory Auto-Recall Error:', err.message);
    return { entities: [], relations: [] };
  }
}

// CLI invocation support
if (process.argv[1]?.endsWith('memory_autorecall.mjs')) {
  const q = process.argv[2] || 'all';
  const result = await autorecall(q);
  console.log(JSON.stringify(result, null, 2));
}
