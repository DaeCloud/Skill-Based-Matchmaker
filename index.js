const express = require('express');
const path = require('path');
const fs = require('fs');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');

require('dotenv').config();

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

// Initialize Passport and restore authentication state, if any, from the session
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  },
  (accessToken, refreshToken, profile, done) => {
    // Use the profile information (mainly profile id) to check if the user is registered in your DB
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});



// Middleware to protect routes
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
};



app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

// Middleware to serve static files from the 'protected' folder


// Google OAuth routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication, redirect home.
    res.redirect('/');
  }
);

// Serve static files from the 'protected' folder
app.use('/', isAuthenticated, express.static(path.join(__dirname, 'protected')));

// Load data from JSON files
const playersFilePath = path.join(__dirname, 'data/players.json');
const scoresFilePath = path.join(__dirname, 'data/scores.json');

const readPlayers = () => {
  const data = fs.readFileSync(playersFilePath, 'utf8');
  return JSON.parse(data);
};

const writePlayers = (players) => {
  fs.writeFileSync(playersFilePath, JSON.stringify(players, null, 2), 'utf8');
};

const readScores = () => {
  const data = fs.readFileSync(scoresFilePath, 'utf8');
  return JSON.parse(data);
};

const writeScores = (scores) => {
  fs.writeFileSync(scoresFilePath, JSON.stringify(scores, null, 2), 'utf8');
};

// Define a GET endpoint that returns all players
app.get('/api/players', isAuthenticated, (req, res) => {
  const players = readPlayers();
  res.json(players);
});

app.get('/api/player/:playerId', isAuthenticated, (req, res) => {
    let playerId = parseInt(req.params.playerId);
    const players = readPlayers();
    let player = players.find(s => s.id === playerId);
    res.json(player);
});

// Define a POST endpoint to add a new player
app.post('/api/players', isAuthenticated, (req, res) => {
    const players = readPlayers();
    const scores = readScores(); // Read scores data
    const newPlayerId = players.length ? players[players.length - 1].id + 1 : 1;
    const newPlayer = {
        id: newPlayerId,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        username: req.body.username
    };

    // Add new player to players.json
    players.push(newPlayer);
    writePlayers(players);

    // Add new player to scores.json with an empty array of scores
    const newPlayerScoresEntry = {
        playerId: newPlayerId,
        scores: []
    };
    scores.push(newPlayerScoresEntry);
    writeScores(scores);

    res.json(newPlayer);
});

// Define a GET endpoint that returns scores for a specific player
app.get('/api/scores/:playerId', isAuthenticated, (req, res) => {
  const scores = readScores();
  const playerId = parseInt(req.params.playerId, 10);
  const playerScores = scores.find(s => s.playerId === playerId);
  if (playerScores) {
    res.json(playerScores);
  } else {
    res.status(404).json({ error: 'Player not found' });
  }
});

// Define a POST endpoint to add a new score for a specific player
app.post('/api/scores/:playerId', isAuthenticated, (req, res) => {
  const scores = readScores();
  const playerId = parseInt(req.params.playerId);
  const playerScores = scores.find(s => s.playerId === playerId);

  if (playerScores) {
    const newScore = {
      scoreId: playerScores.scores.length ? playerScores.scores[playerScores.scores.length - 1].scoreId + 1 : 1,
      value: parseInt(req.body.value),
      date: new Date().toISOString()
    };
    playerScores.scores.push(newScore);
  } else {
    const newScoreEntry = {
      playerId: playerId,
      scores: [
        {
          scoreId: 1,
          value: req.body.value,
          date: new Date().toISOString()
        }
      ]
    };
    scores.push(newScoreEntry);
  }

  writeScores(scores);
  res.json({ message: 'Score added successfully' });
});

// Define a GET endpoint that calculates and returns the player's skill level
app.get('/api/skill/:playerId', isAuthenticated, (req, res) => {
    const scores = readScores();
    const playerId = parseInt(req.params.playerId, 10);
    const playerScores = scores.find(s => s.playerId === playerId);

    if (playerScores) {
        const scoresWithDates = playerScores.scores.map(score => ({
            ...score,
            date: new Date(score.date)
        }));

        // Sort scores by date, newest first
        scoresWithDates.sort((a, b) => b.date - a.date);

        // Calculate weighted average
        let totalWeight = 0;
        let weightedSum = 0;

        scoresWithDates.forEach((score, index) => {
            const weight = 1 / (index + 1); // More recent scores have higher weights
            totalWeight += weight;
            weightedSum += score.value * weight;
        });

        const weightedAverage = totalWeight > 0 ? weightedSum / totalWeight : 0; // If totalWeight is 0, set skill level to 0

        res.json({ skillLevel: weightedAverage });
    } else {
        // If player has no scores, return skill level of 0
        res.json({ skillLevel: 0 });
    }
});

// Endpoint to change username
app.put('/api/players', isAuthenticated, (req, res) => {
    const { existingUsername, newUsername } = req.body;
    const players = readPlayers();
    const player = players.find(player => player.username === existingUsername);

    if (!player) {
        return res.status(404).json({ error: 'Player not found' });
    }

    // Update the username
    player.username = newUsername;
    writePlayers(players);
    res.json({ message: 'Username changed successfully', player });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
