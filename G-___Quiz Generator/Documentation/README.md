# Quizzy

## Summary

Quizzy is a modern, premium SaaS quiz generation and learning platform. It allows users to instantly generate high-quality quizzes and flashcards from text, URLs, or PDF documents. The application features a rich analytics dashboard, gamified arcade challenges, global leaderboards, and detailed performance tracking.

---

## Features

* **AI Quiz Generation**: Automatically create MCQ, short-answer, and mixed-mode quizzes from uploaded content.
* **Comprehensive Dashboard**: Track accuracy, XP, streaks, and performance trends over time.
* **Gamification & Badges**: Unlock rarity-based achievements, earn XP rewards, and complete daily arcade challenges.
* **Mini Arcade**: Integrated educational mini-games (Memory Match, Reaction Tap, Recall, Word Scramble).
* **Flashcards**: Auto-generated study decks with an interactive 3D flip-card UI.
* **Global Leaderboard**: Compete with other learners globally on XP and quiz performance.
* **Premium SaaS Design**: A pristine, compact, minimal UI inspired by platforms like Vercel and Stripe.

---

## Architecture Overview

### Backend

* Built with Node.js
* RESTful API architecture connecting to persistent cloud storage
* Full JWT-based authentication system
* Handles:
  * AI content extraction (PDF, URL, Text)
  * Secure user sessions
  * Global leaderboard synchronization

### Frontend

* Built with Vanilla JavaScript, Vite, and highly optimized custom CSS
* Component-driven architecture using robust ES modules
* Zero heavy UI frameworks—yielding lightning-fast load times

---

## Core Logic Evaluation

* Response evaluation prioritizes:

  1. Correctness
  2. Time taken
* Leaderboard is dynamically updated based on sorted responses
* Session lifecycle is managed entirely in memory

Observation:
While the logic is efficient for small-scale use, it lacks safeguards for edge cases such as duplicate submissions, disconnections, and race conditions.

---

## Setup and Execution

```bash
git clone https://github.com/anshula-2006/quizzy.git
cd quizzy

cd backend
npm install
npm start

cd ../frontend
npm install
npm run dev
```

---

## Suggested Improvements

* Introduce persistent storage (MongoDB or Redis)
* Add authentication and role management
* Implement validation and error handling mechanisms
* Handle edge cases (reconnections, duplicate answers, timeout sync)
* Add deployment support (Docker, environment variables)
* Improve UI feedback for users during live sessions

---

## Overall Assessment

Quizzy demonstrates a solid understanding of real-time systems and event-driven architecture. It is a good functional prototype, but requires improvements in scalability, robustness, and production-readiness to move beyond a basic implementation.
