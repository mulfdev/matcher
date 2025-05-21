export type GoogleAuthRes = { email: string; name: string; userId: string };

export type Skill = string;

export type Experience = {
  company: string;
  duration_months: number;
  end_date: string;
  responsibilities: string[];
  start_date: string;
  title: string;
};

export type ResumeData = {
  skills: Skill[];
  experience: Experience[];
  total_experience_years: number;
  career_level: string;
  category: string;
  summary: string;
};
