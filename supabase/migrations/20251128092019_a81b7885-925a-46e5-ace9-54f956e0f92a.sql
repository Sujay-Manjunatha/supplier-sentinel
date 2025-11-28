-- Create new table for negative list items
CREATE TABLE IF NOT EXISTS public.negative_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'supplier_code',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'Allgemein',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.negative_list_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own negative list items"
  ON public.negative_list_items
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own negative list items"
  ON public.negative_list_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own negative list items"
  ON public.negative_list_items
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own negative list items"
  ON public.negative_list_items
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.negative_list_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Drop old tables that are no longer needed
DROP TABLE IF EXISTS public.accepted_requirements CASCADE;
DROP TABLE IF EXISTS public.baseline_documents CASCADE;