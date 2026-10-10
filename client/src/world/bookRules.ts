// The dungeon's library (Books.tsx): the classics of computing, and two of the dungeon's own, on the bookcases in the
// Overlord's office and in each chamber. Pure: which books exist, and how a shelf's worth of them stands on a board.

export interface BookInfo {
  id: string;
  title: string;
  /** What fits on the spine. */
  spine: string;
  by: string;
  year: string;
  /** A line or two about it, shown when you press E on its spine. */
  about: string;
  /** One of the dungeon's own books, not a real one. */
  dungeon?: boolean;
}

export const LIBRARY: BookInfo[] = [
  { id: 'taocp1', title: 'The Art of Computer Programming, Volume 1: Fundamental Algorithms', spine: 'Art of Computer Programming I', by: 'Donald E. Knuth', year: '1968', about: "The first volume of Knuth's study of algorithms. He has been writing the series since the 1960s, and it isn't finished yet." },
  { id: 'sicp', title: 'Structure and Interpretation of Computer Programs', spine: 'Structure & Interpretation', by: 'Harold Abelson and Gerald Jay Sussman, with Julie Sussman', year: '1985', about: "MIT's introductory programming text, built around the Scheme language. Known as the wizard book, after the wizard on its cover." },
  { id: 'kr', title: 'The C Programming Language', spine: 'The C Programming Language', by: 'Brian W. Kernighan and Dennis M. Ritchie', year: '1978', about: 'The book on C, by Dennis Ritchie, who created the language, and Brian Kernighan. Its first example prints "hello, world".' },
  { id: 'dragon', title: 'Compilers: Principles, Techniques, and Tools', spine: 'Compilers', by: 'Alfred V. Aho, Ravi Sethi and Jeffrey D. Ullman', year: '1986', about: 'How a compiler turns source code into machine code. Called the Dragon Book, after the dragon on its cover.' },
  { id: 'gof', title: 'Design Patterns: Elements of Reusable Object-Oriented Software', spine: 'Design Patterns', by: 'Erich Gamma, Richard Helm, Ralph Johnson and John Vlissides', year: '1994', about: '23 patterns for object-oriented design. Its four authors are known as the Gang of Four.' },
  { id: 'mmm', title: 'The Mythical Man-Month', spine: 'The Mythical Man-Month', by: 'Frederick P. Brooks Jr.', year: '1975', about: "Lessons from building IBM's OS/360. Brooks's law: adding people to a late software project makes it later." },
  { id: 'geb', title: 'Gödel, Escher, Bach: An Eternal Golden Braid', spine: 'Gödel, Escher, Bach', by: 'Douglas R. Hofstadter', year: '1979', about: "On minds and self-reference, through Gödel's mathematics, Escher's drawings and Bach's music. It won the Pulitzer Prize for general nonfiction in 1980." },
  { id: 'clrs', title: 'Introduction to Algorithms', spine: 'Introduction to Algorithms', by: 'Thomas H. Cormen, Charles E. Leiserson and Ronald L. Rivest; Clifford Stein from the second edition', year: '1990', about: "The standard university text on algorithms, often called CLRS after its authors' initials." },
  { id: 'prag', title: 'The Pragmatic Programmer', spine: 'The Pragmatic Programmer', by: 'Andrew Hunt and David Thomas', year: '1999', about: "Practical advice for working programmers. It gave us DRY: don't repeat yourself." },
  { id: 'nand', title: 'The Elements of Computing Systems', spine: 'Elements of Computing Systems', by: 'Noam Nisan and Shimon Schocken', year: '2005', about: 'Build a whole computer, from NAND gates up to an operating system. Taught as the course From Nand to Tetris.' },
  { id: 'turing', title: 'On Computable Numbers, with an Application to the Entscheidungsproblem', spine: 'On Computable Numbers', by: 'Alan Turing', year: '1936', about: 'The paper that described what we now call the Turing machine, and showed that some problems no machine can solve.' },
  { id: 'lovelace', title: "Notes on Menabrea's Sketch of the Analytical Engine", spine: 'Notes on the Analytical Engine', by: 'Ada Lovelace', year: '1843', about: "Her Note G sets out the steps for Babbage's Analytical Engine to compute Bernoulli numbers, often called the first computer program." },
  { id: 'ledger', title: "The Overlord's Ledger, Volume I", spine: "The Overlord's Ledger I", by: 'the Overlord', year: 'this year', about: 'Every chamber, every coder and every merge, in the Overlord\'s own hand. Volume II is still being written.', dungeon: true },
  { id: 'taocp2', title: 'The Art of Computer Programming, Volume 2: Seminumerical Algorithms', spine: 'Art of Computer Programming II', by: 'Donald E. Knuth', year: '1969', about: 'Random numbers and arithmetic: how a computer should generate the one and carry out the other.' },
  { id: 'refactoring', title: 'Refactoring: Improving the Design of Existing Code', spine: 'Refactoring', by: 'Martin Fowler', year: '1999', about: 'How to improve the design of code that already works, one small, safe step at a time.' },
  { id: 'cc', title: 'Code Complete', spine: 'Code Complete', by: 'Steve McConnell', year: '1993', about: 'A long handbook on building software well: naming, layout, debugging and the rest of the craft.' },
  { id: 'hd', title: "Hacker's Delight", spine: "Hacker's Delight", by: 'Henry S. Warren Jr.', year: '2002', about: 'Tricks with bits: counting them, reversing them, and dividing without a divide instruction.' },
  { id: 'pearls', title: 'Programming Pearls', spine: 'Programming Pearls', by: 'Jon Bentley', year: '1986', about: "Essays from Bentley's column in Communications of the ACM, on thinking clearly about programs before writing them." },
  { id: 'wirth', title: 'Algorithms + Data Structures = Programs', spine: 'Algorithms + Data Structures', by: 'Niklaus Wirth', year: '1976', about: 'Wirth, who designed Pascal, on how a program is its algorithms and its data structures together.' },
  { id: 'soul', title: 'The Soul of a New Machine', spine: 'The Soul of a New Machine', by: 'Tracy Kidder', year: '1981', about: 'A team at Data General races to build a new computer. It won the Pulitzer Prize for general nonfiction in 1982.' },
  { id: 'code', title: 'Code: The Hidden Language of Computer Hardware and Software', spine: 'Code', by: 'Charles Petzold', year: '1999', about: 'From Morse code and light bulbs to a working computer, explained one step at a time.' },
  { id: 'taocp3', title: 'The Art of Computer Programming, Volume 3: Sorting and Searching', spine: 'Art of Computer Programming III', by: 'Donald E. Knuth', year: '1973', about: 'Sorting and searching, with the mathematics of how fast each method runs.' },
  { id: 'keeping', title: 'On the Keeping of Coders', spine: 'On the Keeping of Coders', by: 'Vivienne, DungeonMaster', year: 'this year', about: 'A handbook for a guild whose coders work through the night. Chapter twelve: they ask before they remove things.', dungeon: true },
  { id: 'aima', title: 'Artificial Intelligence: A Modern Approach', spine: 'Artificial Intelligence', by: 'Stuart Russell and Peter Norvig', year: '1995', about: 'A standard university textbook on artificial intelligence.' },
  { id: 'hackers', title: 'Hackers: Heroes of the Computer Revolution', spine: 'Hackers', by: 'Steven Levy', year: '1984', about: 'The early hackers at MIT and beyond, and the hacker ethic they shared.' },
  { id: 'unix', title: 'The Unix Programming Environment', spine: 'The Unix Programming Environment', by: 'Brian W. Kernighan and Rob Pike', year: '1984', about: 'How to work in Unix: the shell, pipes, and small tools that each do one thing.' },
  { id: 'okasaki', title: 'Purely Functional Data Structures', spine: 'Purely Functional Data Structures', by: 'Chris Okasaki', year: '1998', about: 'Data structures that never change once built, and how to make them fast.' },
  { id: 'schemer', title: 'The Little Schemer', spine: 'The Little Schemer', by: 'Daniel P. Friedman and Matthias Felleisen', year: '1995', about: 'Teaches recursion through questions and answers. It began in 1974 as The Little LISPer.' },
  { id: 'tapl', title: 'Types and Programming Languages', spine: 'Types and Programming Languages', by: 'Benjamin C. Pierce', year: '2002', about: 'What type systems are, and how to reason about them.' },
];

/** Bindings: the dungeon's dyes, darkened to leather. */
export const LEATHERS = ['#5a1e16', '#2f4a2a', '#7a5a1c', '#25324f', '#4a2a3a', '#3b2a1a', '#6b3b1f', '#1f3a3a'];

export interface PlacedBook {
  /** Centre of what it covers along the board (m), the board's middle at 0. */
  x: number;
  /** How much of the board it covers (m). */
  footprint: number;
  /** Its thickness (spine width), height and depth (m). */
  t: number;
  h: number;
  d: number;
  /** Bottom above the board (m): 0 standing or at the foot of a pile, above that a book lying on another. */
  y: number;
  /** Highest point above the board (m). */
  top: number;
  /** Leaning (radians): its top rests against the book to its -x side and its foot sits out in the gap; 0 upright. */
  lean: number;
  /** Lying flat in a pile. */
  lying: boolean;
  color: string;
  /** The title on its spine, or none for a plain one. */
  book: BookInfo | null;
}

/** A small seeded generator (mulberry32), so a shelf looks the same every visit. */
function random(seed: number) {
  let a = (seed * 2654435761 + 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One board's books, `width` long with `clear` above it: runs of upright books with now and then a small pile lying
 * flat, a gap with the last book leaning into it, and a few titled spines spread among plain ones. Titles come from
 * LIBRARY in order from `offset`, so neighbouring shelves show different books.
 */
export function shelfRow(seed: number, width: number, clear: number, offset: number): PlacedBook[] {
  const r = random(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const maxTop = clear - 0.02;
  const out: PlacedBook[] = [];
  let x = -width / 2 + 0.01 + r() * 0.03;
  const end = width / 2;
  const book = (lying: boolean): Omit<PlacedBook, 'x' | 'footprint' | 'y' | 'top' | 'lean'> => ({
    t: 0.025 + r() * 0.04,
    h: Math.min(maxTop - 0.005, 0.19 + r() * 0.1),
    d: 0.14 + r() * 0.05,
    lying,
    color: pick(LEATHERS),
    book: null,
  });
  while (x < end) {
    // a run of upright books
    const run = 4 + Math.floor(r() * 8);
    for (let i = 0; i < run; i++) {
      const b = book(false);
      if (x + b.t > end) {
        x = end;
        break;
      }
      out.push({ ...b, x: x + b.t / 2, footprint: b.t, y: 0, top: b.h, lean: 0 });
      x += b.t + (r() < 0.15 ? 0.004 : 0);
    }
    if (x >= end) break;
    // then a pile lying flat, or a gap with the last book leaning into it
    if (r() < 0.35) {
      const n = 2 + Math.floor(r() * 2);
      const len = 0.19 + r() * 0.05;
      if (x + 0.01 + len > end) break;
      let y = 0;
      for (let i = 0; i < n && y + 0.04 < maxTop; i++) {
        const b = book(true);
        out.push({ ...b, h: len - i * 0.012, x: x + 0.01 + len / 2, footprint: len, y, top: y + b.t, lean: 0 });
        y += b.t;
      }
      x += 0.01 + len + 0.01;
    } else {
      const last = out[out.length - 1];
      const gap = 0.04 + r() * 0.08;
      if (last && !last.lying && last.lean === 0 && x + gap < end) {
        const lean = 0.12 + r() * 0.16;
        last.lean = lean;
        // a thick book's corner rises as it tips: shorten it so it still clears the board above
        last.h = Math.min(last.h, (maxTop - 0.002 - last.t * Math.sin(lean)) / Math.cos(lean));
        // pivoting on its bottom +x corner: its top swings out over the gap, and it stands a little lower
        last.footprint = last.t * Math.cos(lean) + last.h * Math.sin(lean);
        last.x = x - last.t + last.footprint / 2;
        last.top = last.h * Math.cos(lean) + last.t * Math.sin(lean);
        x += last.footprint - last.t;
      }
      x += gap;
    }
  }
  // titles on a few spread-out upright or bottom-of-pile books
  const candidates = out.filter((b) => !b.lying || b.y === 0);
  const count = Math.min(candidates.length - 1, 4 + Math.floor(r() * 3));
  for (let k = 0; k < count; k++) {
    const b = candidates[Math.floor(((k + 0.5) / count) * candidates.length)];
    b.book = LIBRARY[(offset + k) % LIBRARY.length];
  }
  return out;
}
