-- Create baseline_documents table to store user's supplier code
CREATE TABLE public.baseline_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create comparison_documents table to store customer supplier codes
CREATE TABLE public.comparison_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  baseline_document_id UUID NOT NULL REFERENCES public.baseline_documents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create gap_analyses table to store analysis results
CREATE TABLE public.gap_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  baseline_document_id UUID NOT NULL REFERENCES public.baseline_documents(id) ON DELETE CASCADE,
  comparison_document_id UUID NOT NULL REFERENCES public.comparison_documents(id) ON DELETE CASCADE,
  overall_compliance_percentage NUMERIC(5,2) NOT NULL,
  total_gaps INTEGER NOT NULL DEFAULT 0,
  critical_gaps INTEGER NOT NULL DEFAULT 0,
  medium_gaps INTEGER NOT NULL DEFAULT 0,
  low_gaps INTEGER NOT NULL DEFAULT 0,
  gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.baseline_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparison_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gap_analyses ENABLE ROW LEVEL SECURITY;

-- RLS policies for baseline_documents
CREATE POLICY "Users can view their own baseline documents"
  ON public.baseline_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own baseline documents"
  ON public.baseline_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own baseline documents"
  ON public.baseline_documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own baseline documents"
  ON public.baseline_documents FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for comparison_documents
CREATE POLICY "Users can view their own comparison documents"
  ON public.comparison_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own comparison documents"
  ON public.comparison_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comparison documents"
  ON public.comparison_documents FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for gap_analyses
CREATE POLICY "Users can view their own gap analyses"
  ON public.gap_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own gap analyses"
  ON public.gap_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own gap analyses"
  ON public.gap_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for baseline_documents
CREATE TRIGGER set_baseline_documents_updated_at
  BEFORE UPDATE ON public.baseline_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();