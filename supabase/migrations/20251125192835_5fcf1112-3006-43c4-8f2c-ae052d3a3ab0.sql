-- Create table for completed evaluations
CREATE TABLE public.completed_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  comparison_document_id UUID NOT NULL REFERENCES public.comparison_documents(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  title TEXT NOT NULL,
  gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  decisions JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_template TEXT,
  overall_compliance NUMERIC NOT NULL,
  critical_gaps INTEGER NOT NULL DEFAULT 0,
  medium_gaps INTEGER NOT NULL DEFAULT 0,
  low_gaps INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.completed_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own evaluations"
ON public.completed_evaluations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own evaluations"
ON public.completed_evaluations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own evaluations"
ON public.completed_evaluations
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for faster queries
CREATE INDEX idx_completed_evaluations_user_id ON public.completed_evaluations(user_id);
CREATE INDEX idx_completed_evaluations_completed_at ON public.completed_evaluations(completed_at DESC);

-- Add category column to accepted_requirements for grouping
ALTER TABLE public.accepted_requirements 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Allgemein';