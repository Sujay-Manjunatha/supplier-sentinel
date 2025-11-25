-- Create table for permanently accepted requirements
CREATE TABLE public.accepted_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  requirement_text TEXT NOT NULL,
  requirement_hash TEXT NOT NULL,
  section TEXT NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.accepted_requirements ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own accepted requirements"
ON public.accepted_requirements
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own accepted requirements"
ON public.accepted_requirements
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own accepted requirements"
ON public.accepted_requirements
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_accepted_requirements_user_hash ON public.accepted_requirements(user_id, requirement_hash);