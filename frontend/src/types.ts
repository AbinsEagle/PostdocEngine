export interface Researcher {
  id: number;
  name: string;
  email: string;
  field: string;
  institution: string;
  keywords: string;
  bio: string;
  created_at: string;
}

export interface Position {
  id: number;
  title: string;
  institution: string;
  field: string;
  location: string;
  keywords: string;
  description: string;
  salary_min: number | null;
  salary_max: number | null;
  deadline: string | null;
  url: string;
  source: string;
  posted_at: string | null;
  created_at: string;
}

export interface Application {
  id: number;
  researcher_id: number;
  position_id: number;
  status: string;
  notes: string;
  applied_date: string | null;
  next_action: string;
  next_action_date: string | null;
  created_at: string;
  updated_at: string;
  position: Position | null;
}

export interface ResearchItem {
  id: number;
  researcher_id: number;
  title: string;
  type: string;
  status: string;
  notes: string;
  url: string;
  created_at: string;
  updated_at: string;
}

export interface Recommendation {
  position: Position;
  score: number;
  matched_keywords: string[];
  reason: string;
}

export interface Enums {
  application_statuses: string[];
  research_types: string[];
  research_statuses: string[];
}
