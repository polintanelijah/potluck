# 🍲 Potluck

A private social recipe sharing app where friends share what they're actually cooking—not just saving. Post a photo, drop the recipe link, rate it honestly, and see what's worth making based on real attempts from people you trust.

## Features

- **User Authentication** - Secure JWT-based signup and login
- **Private Groups** - Create circles with friends using invite codes
- **Recipe Sharing** - Post recipes with photos, ratings, notes, and source links
- **Social Feed** - See what your friends are cooking in a chronological feed
- **Comments** - Discuss recipes with your group
- **Modern UI** - Dark theme with warm colors, glassmorphism, and smooth animations

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite |
| Routing | React Router v6 |
| State | React Context API |
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| File Upload | Multer |

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

1. **Clone and navigate to the project:**
   ```bash
   cd /Applications/work/classes/startups/potluck
   ```

2. **Install backend dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Install frontend dependencies:**
   ```bash
   cd ../client
   npm install
   ```

### Running the App

1. **Start the backend server (in one terminal):**
   ```bash
   cd server
   npm run dev
   ```
   The API will be running at `http://localhost:3001`

2. **Start the frontend dev server (in another terminal):**
   ```bash
   cd client
   npm run dev
   ```
   The app will be running at `http://localhost:5173`

3. **Open your browser** and go to `http://localhost:5173`

## Project Structure

```
potluck/
├── client/                    # React frontend
│   ├── public/                # Static assets
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── Header.jsx
│   │   │   ├── Modal.jsx
│   │   │   └── RecipeCard.jsx
│   │   ├── context/           # React Context providers
│   │   │   └── AuthContext.jsx
│   │   ├── pages/             # Page components
│   │   │   ├── Feed.jsx
│   │   │   ├── Groups.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── NewRecipe.jsx
│   │   │   ├── RecipeDetail.jsx
│   │   │   └── Register.jsx
│   │   ├── services/          # API client
│   │   │   └── api.js
│   │   ├── styles/            # CSS
│   │   │   └── index.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── server/                    # Express backend
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js    # SQLite setup and schema
│   │   ├── middleware/
│   │   │   └── auth.js        # JWT authentication
│   │   ├── routes/
│   │   │   ├── auth.js        # Auth endpoints
│   │   │   ├── groups.js      # Groups endpoints
│   │   │   └── recipes.js     # Recipes endpoints
│   │   └── index.js           # Express app entry
│   ├── uploads/               # Uploaded images (created automatically)
│   ├── data/                  # SQLite database (created automatically)
│   └── package.json
│
└── README.md
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new account |
| POST | `/api/auth/login` | Login and get JWT |
| GET | `/api/auth/me` | Get current user |

### Recipes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/recipes` | Get feed (all recipes from groups) |
| POST | `/api/recipes` | Create new recipe |
| GET | `/api/recipes/:id` | Get recipe details |
| PUT | `/api/recipes/:id` | Update recipe |
| DELETE | `/api/recipes/:id` | Delete recipe |
| POST | `/api/recipes/:id/comments` | Add comment |

### Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | Get user's groups |
| POST | `/api/groups` | Create new group |
| GET | `/api/groups/:id` | Get group details & members |
| POST | `/api/groups/join` | Join group with invite code |
| POST | `/api/groups/:id/leave` | Leave a group |
| PUT | `/api/groups/:id` | Update group (admin only) |

## User Flow

1. **Register** an account with your name, email, and password
2. **Create a group** for your cooking circle (you'll get an invite code)
3. **Share the invite code** with friends so they can join
4. **Post recipes** - add a photo, rate it, include notes and the source
5. **Browse the feed** to see what everyone's making
6. **Comment** on recipes to share tips or ask questions

## Future Enhancements

- [ ] PostgreSQL for production
- [ ] AWS S3 for image storage
- [ ] Search functionality
- [ ] Recipe collections/favorites
- [ ] User profiles with cooking stats
- [ ] Push notifications
- [ ] Mobile apps (React Native)

## License

MIT
