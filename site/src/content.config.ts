import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    author: z.string().default('SABOOT Advisory Desk'),
    category: z.string().default('Dispute Recovery'),
    readTime: z.string().default('4 min read'),
    tags: z.array(z.string()).default([])
  })
});

export const collections = { guides };
