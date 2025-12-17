import { useState, useEffect } from 'react';

const aliens = [
  '⌇', '⍜', '⏃', '⌰', '⟟', '⟒', '⋏', '⏁', '⊬', '⎍', '⍀', '☌', '⍙', '☊', '⊑',
  '᚛', '᚜', 'ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛊ',
  '░', '▒', '▓', '█', '▀', '▄', '■', '□', '▪', '▫', '◊', '○', '●', '◐', '◑', '◒', '◓',
  '∆', '∇', '∈', '∉', '∋', '∌', '∏', '∐', '∑', '∓', '∔', '∕', '∖', '∗', '∘', '∙'
];

const generateAlien = (length: number): string => {
  const wordCount = Math.max(1, Math.floor(length / 4));
  const words = [];
  for (let i = 0; i < wordCount; i++) {
    const wordLen = Math.floor(Math.random() * 5) + 3;
    const word = Array.from({ length: wordLen }, () => 
      aliens[Math.floor(Math.random() * aliens.length)]
    ).join('');
    words.push(word);
  }
  return words.join(' ');
};

interface AlienTextProps {
  length: number;
}

export function AlienText({ length }: AlienTextProps) {
  const [text, setText] = useState(() => generateAlien(length));

  useEffect(() => {
    const interval = setInterval(() => {
      setText(generateAlien(length));
    }, 100);
    return () => clearInterval(interval);
  }, [length]);

  return <span className="alien-text">{text}</span>;
}
