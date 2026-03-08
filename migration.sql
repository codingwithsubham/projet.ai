-- Migrate id column from bigserial to uuid
alter table documents
  alter column id drop default,
  alter column id set data type uuid using gen_random_uuid(),
  alter column id set default gen_random_uuid();

-- Add metadata column required by SupabaseVectorStore + LangChain indexing
alter table documents add column if not exists metadata jsonb default '{}'::jsonb;

-- Update match_documents to support metadata filtering (used by SupabaseVectorStore)
create or replace function match_documents (
  query_embedding vector(1536),
  filter jsonb default '{}'::jsonb,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where documents.metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;