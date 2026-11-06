// Course certificates: one colour set per course (the certificate itself is white paper, like a printed one).
//  main   blobs, the badge and the scattered vault wheels
//  deep   the thin curve lines and the badge's shaded half
//  accent the rings (a contrasting colour, like orange next to blue)
//  ink    coloured text on white (the VAULTQUEST · COURSE line); must stay readable (contrast ≥ 4.5:1)
// Python and JavaScript use their map colours (gold / cyan). Add a key here when a new course ships.
export const CERT_THEMES = {
  py: { main: '#F5BB45', deep: '#D99A1C', accent: '#3E6DB5', ink: '#7A4E00' },
  js: { main: '#4FD1BF', deep: '#1FA593', accent: '#FF8A5B', ink: '#0A6B5F' }
};
// Used for a course without its own entry.
export const CERT_DEFAULT = { main: '#A993F5', deep: '#7B62D9', accent: '#F2B544', ink: '#5B3FC4' };

// Who signs it: the in-app mentor, not a real person.
export const CERT_SIGNER = { name: 'VAULT AI', role: 'Course Mentor · VaultQuest' };
