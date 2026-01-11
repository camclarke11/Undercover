# Undercover - Party Game

A single-device party game where players try to find the undercover agent among them! One person hosts the game on their phone/device and passes it around for each player to see their secret role.

## How to Play

1. **Host starts a game** - Enter your name and create a new game
2. **Add players** - The host manually types in each player's name (3-12 players)
3. **Role reveal** - Pass the phone to each player one by one so they can secretly see their word
4. **Describe** - Each player gives a one-word clue about their word (host types what they say)
5. **Vote** - Players vote to eliminate who they think is the undercover agent
6. **Win** - Civilians win by eliminating all undercover agents. Undercover wins by surviving!

## Roles

- **Civilian** - You have the main word. Describe it without being too obvious!
- **Undercover** - Your word is similar but different. Blend in!
- **Mr. White** - You have no word! Listen carefully and fake it. If eliminated, guess the civilian word to win!

## Running the App

### Quick Start (Local Development)

1. **Start the backend** (Terminal 1):
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   Backend runs on `http://localhost:3001`

2. **Start the frontend** (Terminal 2):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Frontend runs on `http://localhost:5173`

3. Open your browser to `http://localhost:5173`

### Using Docker

```bash
docker-compose up --build
```

Then open `http://localhost:8080`

## Project Structure

```
Undercover/
├── backend/           # Node.js/Express backend with Socket.io
│   ├── src/
│   │   ├── index.js        # Socket.io server
│   │   ├── GameManager.js  # Game logic
│   │   └── wordDatabase.js # Word pairs
│   └── package.json
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── screens/        # Game screens (Landing, Lobby, RoleReveal, GameScreen, GameOver)
│   │   ├── contexts/       # Socket context
│   │   └── index.css       # Tailwind styles
│   └── package.json
└── docker-compose.yml
```

## Game Flow

1. **Landing** → Host enters their name
2. **Lobby** → Host adds all player names manually
3. **Role Reveal** → Pass-the-phone style, each player taps to see their secret role/word
4. **Describing** → Host types what each player says as their clue
5. **Voting** → Host records each player's vote
6. **Game Over** → See results, play again!

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express, Socket.io
- **Deployment**: Docker, Docker Compose
