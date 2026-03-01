-- Enable pgvector
create extension if not exists vector;

-- Create documents table
create table if not exists documents (
    id uuid primary key default gen_random_uuid(),
    content text,
    metadata jsonb default '{}'::jsonb,
    embedding vector(1536)
);

-- Disable RLS so the Supabase service-role key can insert/read freely
alter table documents disable row level security;

-- Drop old function signature first (return type changed)
drop function if exists match_documents(vector, float, int);
drop function if exists match_documents(vector, jsonb, int);

-- Create match document function (compatible with SupabaseVectorStore)
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