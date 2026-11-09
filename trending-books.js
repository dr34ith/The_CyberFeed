/* Curated "must-read" books shown on the Library shelves when the user hasn't added their own.
   Static data only: spines are drawn in CSS, so no images or network are needed. */
window.CF_BOOK_CATEGORIES = ["Programming", "Networking", "Self-Help", "Productivity", "Mindset", "Cyber & Career"];

// PDFs bundled with the app; readable immediately in the in-app reader.
window.CF_BUILTIN_BOOKS = [];

window.CF_TRENDING_BOOKS = [
  // Networking & people skills
  { title: "Never Eat Alone", author: "Keith Ferrazzi", category: "Networking", why: "A practical playbook for building genuine professional relationships before you need them." },
  { title: "How to Win Friends and Influence People", author: "Dale Carnegie", category: "Networking", why: "The classic on communication, empathy and making people feel heard." },
  { title: "Influence", author: "Robert Cialdini", category: "Networking", why: "The six principles of persuasion, and how to spot them used on you." },
  { title: "Crucial Conversations", author: "Patterson, Grenny et al.", category: "Networking", why: "How to talk when stakes are high, opinions differ and emotions run strong." },
  { title: "Tribe of Mentors", author: "Tim Ferriss", category: "Networking", why: "Short advice from 100+ high performers; great for learning who to reach out to and what to ask." },
  { title: "Give and Take", author: "Adam Grant", category: "Networking", why: "Why generous people often end up the most successful, and how to give without burning out." },

  // Self-help & improvement
  { title: "The 7 Habits of Highly Effective People", author: "Stephen R. Covey", category: "Self-Help", why: "Principle-centred habits for personal and professional effectiveness." },
  { title: "Atomic Habits", author: "James Clear", category: "Self-Help", why: "Tiny, compounding changes that make good habits easy and bad ones hard." },
  { title: "Can't Hurt Me", author: "David Goggins", category: "Self-Help", why: "A blunt story about mental toughness and pushing past self-imposed limits." },
  { title: "Ikigai", author: "Héctor García & Francesc Miralles", category: "Self-Help", why: "The Japanese idea of a reason for being, and how it supports a long, calm life." },
  { title: "The Subtle Art of Not Giving a F*ck", author: "Mark Manson", category: "Self-Help", why: "Choosing what to care about, and accepting trade-offs, instead of chasing constant positivity." },

  // Productivity
  { title: "Deep Work", author: "Cal Newport", category: "Productivity", why: "How to focus without distraction on cognitively demanding work." },
  { title: "Getting Things Done", author: "David Allen", category: "Productivity", why: "A stress-free system for capturing tasks and deciding what to do next." },
  { title: "Essentialism", author: "Greg McKeown", category: "Productivity", why: "The disciplined pursuit of less, but better." },
  { title: "So Good They Can't Ignore You", author: "Cal Newport", category: "Productivity", why: "Why building rare skills beats 'following your passion' for a great career." },
  { title: "Show Your Work!", author: "Austin Kleon", category: "Productivity", why: "Share your process publicly to get noticed, get feedback and find opportunities." },

  // Mindset & money
  { title: "Mindset", author: "Carol S. Dweck", category: "Mindset", why: "How a growth mindset changes the way you learn, fail and improve." },
  { title: "Thinking, Fast and Slow", author: "Daniel Kahneman", category: "Mindset", why: "How two modes of thinking cause predictable errors in our judgment." },
  { title: "The Psychology of Money", author: "Morgan Housel", category: "Mindset", why: "Timeless lessons on how behaviour, not intelligence, drives financial outcomes." },
  { title: "Start With Why", author: "Simon Sinek", category: "Mindset", why: "Leaders and teams that begin with purpose inspire more than those that begin with what they do." },
  { title: "The Almanack of Naval Ravikant", author: "Eric Jorgenson", category: "Mindset", why: "Collected thinking on wealth, leverage and happiness." },

  // Programming languages
  { title: "Automate the Boring Stuff with Python", author: "Al Sweigart", category: "Programming", why: "Beginner-friendly Python for automating everyday tasks; free to read online." },
  { title: "Python Crash Course", author: "Eric Matthes", category: "Programming", why: "A fast, project-based introduction to Python." },
  { title: "Eloquent JavaScript", author: "Marijn Haverbeke", category: "Programming", why: "A deep, modern guide to JavaScript and programming ideas; free online." },
  { title: "The C Programming Language", author: "Kernighan & Ritchie", category: "Programming", why: "The classic on C, essential for understanding memory and low-level security bugs." },
  { title: "Clean Code", author: "Robert C. Martin", category: "Programming", why: "Habits for writing readable, maintainable code in any language." },
  { title: "Black Hat Python", author: "Justin Seitz & Tim Arnold", category: "Programming", why: "Python for offensive security: networking, scanning and tooling." },

  // Cyber & career
  { title: "The Art of Deception", author: "Kevin Mitnick", category: "Cyber & Career", why: "Social engineering from a famous ex-hacker: the human side of security." },
  { title: "Ghost in the Wires", author: "Kevin Mitnick", category: "Cyber & Career", why: "Mitnick's own story of being the most wanted computer criminal." },
  { title: "Sandworm", author: "Andy Greenberg", category: "Cyber & Career", why: "The investigation into Russian state hackers and the world's most destructive cyberattacks." },
  { title: "Countdown to Zero Day", author: "Kim Zetter", category: "Cyber & Career", why: "The story of Stuxnet, the first digital weapon." },
  { title: "Hacking: The Art of Exploitation", author: "Jon Erickson", category: "Cyber & Career", why: "A hands-on, low-level introduction to how exploits really work." },
  { title: "The Pragmatic Programmer", author: "Hunt & Thomas", category: "Cyber & Career", why: "Habits and craft for engineers who want to keep growing." },
];

// Free YouTube courses (kind: "video" or "playlist"; ref is the YouTube id). Played in-app via youtube-nocookie.
window.CF_COURSE_TOPICS = ["Forensics & DFIR", "Malware", "Cybersecurity", "Linux", "Networking", "Programming"];
window.CF_COURSES = [
  // Forensics & DFIR
  { title: "Introduction to Windows Forensics", channel: "13Cubed", topic: "Forensics & DFIR", kind: "video", ref: "VYROU-ZwZX8", why: "Start here: how Windows artifacts are collected and analysed." },
  { title: "Prefetch Deep Dive", channel: "13Cubed", topic: "Forensics & DFIR", kind: "video", ref: "f4RAtR_3zcs", why: "What Prefetch files prove about program execution." },
  { title: "The Volume Shadow Knows", channel: "13Cubed", topic: "Forensics & DFIR", kind: "video", ref: "qYTVRjb7KrI", why: "Volume Shadow Copies as forensic evidence." },
  { title: "Introduction to Arsenal Image Mounter", channel: "13Cubed", topic: "Forensics & DFIR", kind: "video", ref: "u8qkfaqO9sE", why: "Mount forensic images to examine them safely." },
  { title: "Windows Memory Forensics Challenge", channel: "13Cubed", topic: "Forensics & DFIR", kind: "video", ref: "6JN6iAenEoA", why: "Hands-on memory forensics practice." },
  { title: "Linux Memory Forensics Challenge", channel: "13Cubed", topic: "Forensics & DFIR", kind: "video", ref: "IHd85h6T57E", why: "Hands-on Linux memory analysis practice." },
  { title: "Digital Forensics and Incident Response (DFIR) Full Course", channel: "YouTube", topic: "Forensics & DFIR", kind: "playlist", ref: "PLmi6GtTayDkcqc21yiwejvT-r8pQh5R7B", why: "A full DFIR course playlist for beginners." },
  { title: "DFIR Complete Course (9.5 hours, SOC Level 1)", channel: "YouTube", topic: "Forensics & DFIR", kind: "video", ref: "mKUZx1z9dxo", why: "Walkthrough of the DFIR module with timestamps." },
  // Malware
  { title: "Malware Analysis in 5+ Hours: Full Course", channel: "YouTube", topic: "Malware", kind: "video", ref: "qA0YcYMRWyI", why: "Practical malware analysis and triage. Run samples only in an isolated VM." },
  // Linux
  { title: "Kali Linux Full Course", channel: "YouTube", topic: "Linux", kind: "video", ref: "bohoiaP31nw", why: "Kali Linux for ethical hacking and pentesting." },
  { title: "Linux for Ethical Hackers: Comprehensive Course", channel: "YouTube", topic: "Linux", kind: "video", ref: "3cYz3L2XSDI", why: "Linux fundamentals for security work." },
  // Core
  { title: "CompTIA Security+ SY0-701 Training Course", channel: "Professor Messer", topic: "Cybersecurity", kind: "playlist", ref: "PLG49S3nxzAnl4QDVqK-hOnoqcSKEIDDuv", why: "Complete video course for the Security+ exam." },
  { title: "CompTIA Network+ N10-009 Training Course", channel: "Professor Messer", topic: "Networking", kind: "playlist", ref: "PLG49S3nxzAnl_tQe3kvnmeMid0mjF8Le8", why: "Networking fundamentals to certification level." },
  { title: "Free Ethical Hacking course (70 hours, Kali labs)", channel: "YouTube", topic: "Cybersecurity", kind: "video", ref: "htez3rhhPO8", why: "Beginner-friendly ethical hacking with Kali Linux labs." },
  { title: "Harvard CS50 (2023): Full Computer Science Course", channel: "YouTube", topic: "Programming", kind: "video", ref: "LfaMVlDaQ24", why: "Harvard's intro to computer science and programming." },
  { title: "Python for Everybody: Full University Python Course", channel: "YouTube", topic: "Programming", kind: "video", ref: "8DvywoWv6fI", why: "A complete university-style Python course." },
  { title: "Harvard CS50's Introduction to Programming with Python", channel: "YouTube", topic: "Programming", kind: "video", ref: "nLRL_NcnK-4", why: "A focused, practical Python course." },
  { title: "Harvard CS50's Web Programming with Python and JavaScript", channel: "YouTube", topic: "Programming", kind: "video", ref: "vzGllw18DkA", why: "Build web apps with Python and JavaScript." },
];
