// src/utils/skinCareQuotes.js

export const skinCareQuotes = [
  {
    quote: "Healthy skin is a reflection of overall wellness.",
    author: "Dr. Murad"
  },
  {
    quote: "Sun protection is the best anti-aging product you can use.",
    author: "Dermatology Association"
  },
  {
    quote: "Hydration is the foundation of healthy skin.",
    author: "Skin Health Institute"
  },
  {
    quote: "Early detection and treatment can prevent skin conditions from worsening.",
    author: "Medical Research"
  },
  {
    quote: "Your skin barrier is your first line of defense - protect it.",
    author: "Dermatology Clinic"
  },
  {
    quote: "Moisturize within 3 minutes after bathing for maximum benefit.",
    author: "Skincare Best Practices"
  },
  {
    quote: "Avoid hot water - it strips natural oils from your skin.",
    author: "Dermatologist Advice"
  },
  {
    quote: "Gentle is better - harsh products can damage your skin barrier.",
    author: "Clinical Guidelines"
  },
  {
    quote: "Consistency in skincare is more important than expensive products.",
    author: "Dermatology Research"
  },
  {
    quote: "Know your triggers - avoiding them is half the battle.",
    author: "Eczema Foundation"
  },
  {
    quote: "Stress management is essential for skin health.",
    author: "Holistic Dermatology"
  },
  {
    quote: "Sleep is when your skin repairs itself - don't skip it.",
    author: "Sleep Medicine"
  },
  {
    quote: "A patch test can save you from a major reaction.",
    author: "Allergy Guidelines"
  },
  {
    quote: "Your diet affects your skin - eat foods rich in omega-3s.",
    author: "Nutritional Dermatology"
  },
  {
    quote: "Don't self-diagnose - consult a professional for persistent issues.",
    author: "Medical Standards"
  }
];

export const getRandomQuote = () => {
  const randomIndex = Math.floor(Math.random() * skinCareQuotes.length);
  return skinCareQuotes[randomIndex];
};
