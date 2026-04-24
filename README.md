# Quizzy

## Summary

Quizzy is a real-time quiz application that enables a host to conduct live quiz sessions with multiple participants. The system emphasizes low latency communication and ranks users based on correctness and response time. The architecture is lightweight, relying on WebSockets and in-memory storage.

---

## Strengths

* Real-time communication using WebSockets is implemented effectively
* Simple session-based model avoids unnecessary authentication overhead
* Fast response handling due to in-memory data storage
* Clear separation between frontend and backend
* Core functionality is focused and works for the intended use case

---

## Limitations

* No persistent storage; all session data is lost on server restart
* Lack of authentication makes it unsuitable for secure or large-scale deployments
* In-memory session handling may not scale under high concurrency
* Minimal error handling and validation
* No deployment configuration or environment management

---

## Architecture Overview

### Backend

* Built with Node.js and WebSockets
* Maintains a central sessions object
* Handles:

  * Session creation
  * Participant joining
  * Question broadcasting
  * Answer evaluation and ranking

### Frontend

* Built with React and Tailwind CSS
* Provides interfaces for host and participants
* Communicates with backend via WebSocket events

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


