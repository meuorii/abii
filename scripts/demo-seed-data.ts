export type DemoCard = { question: string; answer: string; items?: string[] };
export type DemoTopic = { name: string; cards: DemoCard[] };
export type DemoSubject = { name: string; folder: string; topicFolders: { name: string; topics: DemoTopic[] }[] };

const standard = (question: string, answer: string): DemoCard => ({ question, answer });
const enumeration = (question: string, items: string[]): DemoCard => ({ question, items, answer: items.join("; ") });

export const DEMO_SUBJECTS: DemoSubject[] = [
  {
    name: "Biology", folder: "Science Subjects", topicFolders: [
      { name: "Prelim Lessons", topics: [
        { name: "Cell Structure and Functions", cards: [
          standard("What organelle produces most of the ATP in eukaryotic cells?", "Mitochondria."),
          standard("What is the main function of red blood cells?", "To transport oxygen throughout the body."),
          enumeration("What are the three main components commonly stated in cell theory?", ["All living things are made of cells", "The cell is the basic unit of life", "Cells arise from pre-existing cells"]),
          standard("What is the function of ribosomes?", "They synthesize proteins."),
          standard("Which organelle contains most of a eukaryotic cell's DNA?", "The nucleus."),
          standard("What is the main role of chloroplasts in plant cells?", "They capture light energy for photosynthesis."),
        ] },
        { name: "Human Organ Systems", cards: [
          enumeration("What are the four chambers of the human heart?", ["Right atrium", "Right ventricle", "Left atrium", "Left ventricle"]),
          standard("Where does most gas exchange occur in the lungs?", "In the alveoli."),
          standard("Which organ produces bile to help digest fats?", "The liver."),
          standard("Which system sends electrical signals to coordinate rapid responses?", "The nervous system."),
          standard("What is the main function of the small intestine?", "To complete digestion and absorb most nutrients."),
        ] },
      ] },
      { name: "Midterm Coverage", topics: [{ name: "Genetics and Heredity", cards: [
        standard("What is a gene?", "A segment of DNA that contributes to a functional product or inherited trait."),
        standard("What are alleles?", "Different versions of the same gene."),
        standard("What term describes an allele expressed in a heterozygous individual?", "Dominant."),
        standard("How many chromosomes are in a typical human somatic cell?", "46, arranged in 23 pairs."),
        enumeration("What are the four main types of biological macromolecules?", ["Carbohydrates", "Lipids", "Proteins", "Nucleic acids"]),
      ] }] },
      { name: "Final Exam Review", topics: [{ name: "Ecosystems and Biodiversity", cards: [
        standard("What is an ecosystem?", "A community of organisms interacting with one another and with their physical environment."),
        standard("What role do decomposers play in an ecosystem?", "They break down dead matter and recycle nutrients."),
          enumeration("At what three levels is biodiversity commonly described?", ["Genetic diversity", "Species diversity", "Ecosystem diversity"]),
        standard("In a food chain, what does an arrow usually show?", "The direction energy moves, from the organism eaten to the organism that eats it."),
        enumeration("What are the three broad categories of ecological relationships between species?", ["Competition", "Predation", "Symbiosis"]),
        enumeration("What are the three common forms of symbiosis?", ["Mutualism", "Commensalism", "Parasitism"]),
      ] }] },
    ],
  },
  {
    name: "World History", folder: "Humanities", topicFolders: [
      { name: "Prelim Lessons", topics: [
        { name: "Ancient Civilizations", cards: [
          standard("Which ancient civilization constructed the pyramids at Giza?", "Ancient Egyptian civilization."),
          standard("Which river was central to the development of ancient Egyptian agriculture?", "The Nile River."),
          standard("What writing system did ancient Mesopotamians impress into clay tablets?", "Cuneiform."),
          standard("Which ancient Greek city-state is often associated with the early development of democracy?", "Athens."),
          enumeration("Name three ancient civilizations of Mesopotamia.", ["Sumerian", "Babylonian", "Assyrian"]),
        ] },
        { name: "The Renaissance", cards: [
          standard("In which region did the Renaissance begin?", "The Italian city-states, especially Florence."),
          standard("What does the term Renaissance mean?", "Rebirth."),
          standard("Which artist painted the ceiling of the Sistine Chapel?", "Michelangelo."),
          standard("What invention helped spread books and ideas in fifteenth-century Europe?", "The movable-type printing press."),
        ] },
      ] },
      { name: "Midterm Coverage", topics: [{ name: "Industrial Revolution", cards: [
        standard("In which country did the Industrial Revolution begin?", "Great Britain."),
        standard("Which energy source powered many early industrial steam engines?", "Coal."),
        standard("How did factory production differ from the older cottage industry?", "Workers and machines were concentrated in factories, where production was divided into specialized tasks."),
          enumeration("What three broad changes characterized industrialization?", ["Mechanized production", "Factory-based work", "Urbanization"]),
      ] }] },
      { name: "Final Exam Review", topics: [{ name: "World War I and World War II", cards: [
        standard("What event is commonly identified as the immediate trigger of World War I?", "The assassination of Archduke Franz Ferdinand in 1914."),
        standard("Which 1919 treaty formally ended the state of war between Germany and the Allied powers?", "The Treaty of Versailles."),
        standard("In what year did World War II end?", "1945."),
        enumeration("Name the three Axis powers most commonly associated with World War II.", ["Germany", "Italy", "Japan"]),
        enumeration("Name the three principal Allied powers commonly called the Big Three during World War II.", ["United States", "United Kingdom", "Soviet Union"]),
      ] }] },
    ],
  },
  {
    name: "General Mathematics", folder: "Mathematics", topicFolders: [
      { name: "Prelim Lessons", topics: [
        { name: "Algebra and Equations", cards: [
          standard("Solve for x: 3x + 6 = 21.", "5."),
          enumeration("What are the three common algebraic properties used to rewrite expressions?", ["Commutative property", "Associative property", "Distributive property"]),
          standard("What is the value of 2² + 3²?", "13."),
          standard("Solve for y: 5y = 35.", "7."),
          standard("What is the slope-intercept form of a linear equation?", "y = mx + b, where m is the slope and b is the y-intercept."),
        ] },
        { name: "Functions and Relations", cards: [
          standard("What is a function?", "A relation that assigns exactly one output to each input."),
          standard("If f(x) = 2x + 1, what is f(3)?", "7."),
          enumeration("What are the three common ways to represent a function?", ["Equation", "Table", "Graph"]),
          standard("What does the vertical line test determine?", "Whether a graph represents y as a function of x."),
        ] },
      ] },
      { name: "Midterm Coverage", topics: [{ name: "Geometry", cards: [
        standard("What is the formula for the area of a triangle?", "One-half times the base times the height."),
        standard("How many degrees are in the interior angles of a triangle?", "180 degrees."),
        enumeration("What are the three classifications of triangles by their side lengths?", ["Equilateral", "Isosceles", "Scalene"]),
        standard("What is the Pythagorean theorem for a right triangle?", "a² + b² = c², where c is the hypotenuse."),
        standard("What is the area of a rectangle with length 8 and width 3?", "24 square units."),
      ] }] },
      { name: "Final Exam Review", topics: [{ name: "Probability and Statistics", cards: [
        standard("What is the probability of rolling an even number on a fair six-sided die?", "1/2."),
        standard("What is the mean of 2, 4, and 9?", "5."),
        standard("What does a probability of 0 represent?", "An impossible event in the stated model."),
        enumeration("What are the three common measures of central tendency?", ["Mean", "Median", "Mode"]),
      ] }] },
    ],
  },
  {
    name: "English & Literature", folder: "Humanities", topicFolders: [
      { name: "Prelim Lessons", topics: [
        { name: "Parts of Speech", cards: [
          enumeration("What are three common forms of figurative comparison or description?", ["Simile", "Metaphor", "Personification"]),
          standard("What part of speech modifies a noun or pronoun?", "An adjective."),
          standard("What figure of speech compares two things using like or as?", "A simile."),
          standard("What part of speech expresses an action or state of being?", "A verb."),
        ] },
        { name: "Grammar and Sentence Structure", cards: [
          standard("What is the main purpose of a thesis statement?", "To express the central claim or main argument of a piece of writing."),
          enumeration("What are the four common sentence structures in English grammar?", ["Simple", "Compound", "Complex", "Compound-complex"]),
          standard("What punctuation mark usually separates items in a series?", "A comma."),
          standard("What is subject-verb agreement?", "The grammatical matching of a verb to its subject in person and number."),
        ] },
      ] },
      { name: "Midterm Coverage", topics: [{ name: "Literary Devices", cards: [
        standard("What literary device gives human qualities to nonhuman things?", "Personification."),
        standard("What is a metaphor?", "A direct comparison that describes one thing as another."),
        enumeration("What are the three common types of irony?", ["Verbal irony", "Situational irony", "Dramatic irony"]),
        standard("What is dramatic irony?", "A situation in which the audience knows something important that a character does not."),
      ] }] },
      { name: "Final Exam Review", topics: [{ name: "Poetry and Literature", cards: [
        standard("What is a stanza?", "A grouped set of lines in a poem, often separated by a space."),
        standard("What is the speaker in a poem?", "The voice or persona that speaks in the poem."),
        standard("What does theme mean in a literary work?", "A central idea or insight developed through the work."),
        enumeration("What are the three primary types of literary conflict based on where conflict occurs?", ["Internal conflict", "Interpersonal conflict", "External conflict"]),
      ] }] },
    ],
  },
  {
    name: "Earth Science", folder: "Science Subjects", topicFolders: [
      { name: "Prelim Lessons", topics: [
        { name: "Earth's Structure", cards: [
          standard("Which layer of Earth is primarily composed of liquid iron and nickel?", "The outer core."),
          standard("What is the thin, solid outermost layer of Earth called?", "The crust."),
          enumeration("What are the three main layers of Earth by composition?", ["Crust", "Mantle", "Core"]),
          standard("What is a tectonic plate?", "A large, rigid piece of Earth's lithosphere that moves over the asthenosphere."),
        ] },
        { name: "Rocks and Minerals", cards: [
          enumeration("What are the three main types of rocks?", ["Igneous", "Sedimentary", "Metamorphic"]),
          standard("How does an igneous rock form?", "When molten rock cools and solidifies."),
          standard("What is the Mohs scale used to compare?", "The scratch hardness of minerals."),
        ] },
      ] },
      { name: "Midterm Coverage", topics: [{ name: "Weather and Climate", cards: [
        standard("What is the difference between weather and climate?", "Weather describes short-term atmospheric conditions; climate describes long-term patterns."),
        enumeration("Name four instruments used to measure common weather conditions.", ["Thermometer", "Barometer", "Anemometer", "Hygrometer"]),
        standard("What instrument measures atmospheric pressure?", "A barometer."),
        standard("At what temperature does water freeze on the Celsius scale at standard pressure?", "0°C."),
        enumeration("Name four measurable elements commonly used to describe weather.", ["Temperature", "Air pressure", "Humidity", "Wind"]),
      ] }] },
      { name: "Final Exam Review", topics: [{ name: "The Solar System", cards: [
        standard("Which planet is the largest in the Solar System?", "Jupiter."),
        standard("What force keeps planets in orbit around the Sun?", "Gravity."),
        standard("Which planet is known for its prominent ring system?", "Saturn."),
        standard("What is the asteroid belt?", "A region between Mars and Jupiter containing many small rocky bodies."),
      ] }] },
    ],
  },
];

export function validateDemoDataset() {
  const expected: Record<string, number> = { Biology: 22, "World History": 18, "General Mathematics": 18, "English & Literature": 16, "Earth Science": 16 };
  const errors: string[] = [];
  if (DEMO_SUBJECTS.length !== 5) errors.push("expected exactly five subjects");
  const allQuestions = new Set<string>();
  for (const subject of DEMO_SUBJECTS) {
    const topics = subject.topicFolders.flatMap(folder => folder.topics);
    const cards = topics.flatMap(topic => topic.cards);
    if (cards.length !== expected[subject.name]) errors.push(`${subject.name} expected ${expected[subject.name]} cards, found ${cards.length}`);
    for (const card of cards) {
      const key = card.question.trim().toLocaleLowerCase();
      if (allQuestions.has(key)) errors.push(`duplicate question: ${card.question}`);
      allQuestions.add(key);
      if (!card.question.trim() || !card.answer.trim()) errors.push(`empty question or answer in ${subject.name}`);
      if (card.items && (card.items.length < 2 || card.items.some(item => !item.trim()))) errors.push(`invalid enumeration: ${card.question}`);
    }
  }
  if (allQuestions.size !== 90) errors.push(`expected 90 total cards, found ${allQuestions.size}`);
  if (errors.length) throw new Error(`Demo seed data is invalid: ${errors.join("; ")}`);
  return { subjects: DEMO_SUBJECTS.length, topics: DEMO_SUBJECTS.reduce((sum, subject) => sum + subject.topicFolders.reduce((n, folder) => n + folder.topics.length, 0), 0), cards: allQuestions.size, enumerationCards: DEMO_SUBJECTS.flatMap(subject => subject.topicFolders.flatMap(folder => folder.topics.flatMap(topic => topic.cards))).filter(card => card.items).length };
}
