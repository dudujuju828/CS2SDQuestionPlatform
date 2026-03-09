export interface Question {
  id: string;
  stem: string;
  options: Record<string, string>;
  correct: string;
  rationale: string;
  distractorRationale: Record<string, string>;
}

export interface TopicFile {
  topic: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  questions: Question[];
}

export interface TopicEntry {
  slug: string;
  data: TopicFile;
}

export async function loadAllTopics(): Promise<TopicEntry[]> {
  const modules = import.meta.glob<TopicFile>("/questions/*.json", {
    eager: true,
    import: "default",
  });

  return Object.entries(modules).map(([path, data]) => {
    const filename = path.split("/").pop()!.replace(".json", "");
    return { slug: filename, data };
  });
}
