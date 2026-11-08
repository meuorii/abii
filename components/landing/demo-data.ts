export const demoFolders = [
  { name: "Unit 1", count: 4, topics: ["Introduction to Biology", "Cell Structure", "Cell Functions", "Biological Processes"] },
  { name: "Unit 2", count: 3, topics: ["Genetics", "DNA and RNA", "Patterns of Inheritance"] },
  { name: "Midterm Review", count: 6, topics: ["Cell Theory", "Organelles", "Metabolism", "Enzymes", "Cell Division", "Homeostasis"] },
  { name: "Final Review", count: 5, topics: ["Evolution", "Ecology", "Genetics Review", "Systems", "Scientific Method"] },
] as const;

export type DemoQuizMode = "multiple-choice" | "identification" | "true-false" | "enumeration";
export type DemoQuestion = { prompt: string; options?: readonly string[]; accepted?: readonly string[]; expected?: readonly string[]; explanation: string };
export const demoQuestions: Record<DemoQuizMode, readonly DemoQuestion[]> = {
  "multiple-choice": [
    { prompt: "What is the basic unit of life?", options: ["Tissue", "Cell", "Organ", "Organ system"], accepted: ["Cell"], explanation: "Cells are the smallest structures that carry out the processes of life." },
    { prompt: "Which structure contains a cell's genetic material?", options: ["Nucleus", "Ribosome", "Cell membrane", "Cytoplasm"], accepted: ["Nucleus"], explanation: "In eukaryotic cells, most genetic material is housed in the nucleus." },
  ],
  identification: [
    { prompt: "What organelle is commonly called the powerhouse of the cell?", accepted: ["Mitochondrion", "Mitochondria"], explanation: "Mitochondria release usable energy through cellular respiration." },
    { prompt: "What molecule carries genetic instructions in most living things?", accepted: ["DNA", "Deoxyribonucleic acid"], explanation: "DNA stores the hereditary instructions used by cells." },
  ],
  "true-false": [
    { prompt: "The nucleus contains genetic material in eukaryotic cells.", accepted: ["true"], explanation: "The nucleus stores most of the DNA in a eukaryotic cell." },
    { prompt: "All cells have a membrane around them.", accepted: ["true"], explanation: "A cell membrane separates the cell from its surroundings." },
  ],
  enumeration: [
    { prompt: "Name the three main parts of a typical eukaryotic cell.", expected: ["Cell membrane", "Cytoplasm", "Nucleus"], explanation: "This demo accepts these three terms in any order. Each term is trimmed and compared without regard to capitalization; duplicates do not count twice." },
    { prompt: "Name three structures found in plant cells.", expected: ["Cell wall", "Chloroplast", "Central vacuole"], explanation: "This demo accepts these three terms in any order. Each term is trimmed and compared without regard to capitalization; duplicates do not count twice." },
  ],
};
export const demoMastery = [
  { subject: "Biology Basics", mastery: 75 },
  { subject: "Data Structures", mastery: 60 },
  { subject: "Networking", mastery: 40 },
] as const;
