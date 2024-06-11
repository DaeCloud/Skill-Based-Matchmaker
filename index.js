const express = require("express");
const path = require("path");
const fs = require("fs");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const session = require("express-session");
const MemoryStore = require("memorystore")(session);
const nodeHtmlToImage = require("node-html-to-image");
const puppeteerCore = require("puppeteer-core");

require("dotenv").config();

const app = express();
const router = express.Router();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
    cookie: {
      maxAge: 86400000, // 24 hours
    },
  })
);

// Initialize Passport and restore authentication state, if any, from the session
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    (accessToken, refreshToken, profile, done) => {
      // Use the profile information (mainly profile id) to check if the user is registered in your DB
      const email =
        profile.emails && profile.emails[0] && profile.emails[0].value;
      const user = {
        id: profile.id,
        displayName: profile.displayName,
        email: email,
        photos: profile.photos,
      };
      return done(null, profile);
    }
  )
);

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL,
    },
    (accessToken, refreshToken, profile, done) => {
      const email =
        profile.emails && profile.emails[0] && profile.emails[0].value;
      const user = {
        id: profile.id,
        displayName: profile.displayName,
        email: email,
        photos: profile.photos,
      };
      return done(null, profile);
    }
  )
);

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
  res.redirect(process.env.URL_PATH + "/login");
};

router.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

router.get("/share/:shareId", (req, res) => {
  let shareId = req.params.shareId;
  let filePath = path.join(__dirname, "public/shared.html");

  // Read the HTML file
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading HTML file:", err);
      return res.status(500).send("Internal Server Error");
    }

    // Replace the placeholder with the shareId
    let modifiedData = data.replace("{{shareId}}", shareId);
    modifiedData = modifiedData.replace("{{PATH}}", process.env.URL_PATH);

    // Send the modified HTML file
    res.send(modifiedData);
  });
});

router.get("/api/share/:shareId", (req, res) => {
  let shareId = req.params.shareId;

  let shares = readShared(shareId);

  if (shares.length === 0) {
    res.json({
      success: false,
    });
  } else {
    const games = readGames(shares[0].user_id);
    const players = readPlayers(shares[0].user_id);

    let output = {
      games: games.map((g) => {
        return {
          id: g.id,
          game: g.game,
        };
      }),
      players: players.map((p) => {
        return {
          id: p.id,
          username: p.username,
        };
      }),
      scores: [],
    };

    players.forEach((p) => {
      p.points = 0;
    });

    for (let i = 0; i < games.length; i++) {
      let game = games[i].id;

      let tempPlayers = [];

      for (let j = 0; j < players.length; j++) {
        let player = players[j].id;

        const scores = readScores();
        const playerId = player;
        const gameId = game;
        const playerScores = scores.find((s) => s.playerId === playerId);

        output.scores.push(playerScores);

        playerScores.scores = playerScores.scores.filter(
          (s) => s.game === gameId
        );

        if (playerScores) {
          const scoresWithDates = playerScores.scores.map((score) => ({
            ...score,
            date: new Date(score.date),
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

          const weightedAverage =
            totalWeight > 0 ? weightedSum / totalWeight : 0; // If totalWeight is 0, set skill level to 0

          players[j].skill = weightedAverage;
          tempPlayers.push(players[j]);
        } else {
          // If player has no scores, return skill level of 0
          players[j].skill = 0;
          tempPlayers.push(players[j]);
        }
      }
      tempPlayers = tempPlayers.filter((p) => p.skill !== 0);
      tempPlayers.sort((a, b) => b.skill - a.skill);

      for (let k = 0; k < tempPlayers.length; k++) {
        let points =
          tempPlayers.length - k + (players.length - tempPlayers.length);
        let id = tempPlayers[k].id;

        players.find((p) => {
          if (p.id === id) {
            p.points = p.points + points; // Add points to the existing value
          }
        });
      }
    }

    players.sort((a, b) => b.points - a.points);

    let trimmedLeaderboard = players.map((p) => {
      return {
        id: p.id,
        username: p.username,
        points: p.points,
      };
    });

    output.leaderboard = trimmedLeaderboard;

    output.success = true;

    res.json(output);
  }
});

// Middleware to serve static files from the 'protected' folder

// Google OAuth routes
router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    const users = readUsers();
    const googleUserId = req.user.id; // Assuming `req.user` contains the authenticated user's info

    // Check if user already exists
    let user = users.find((u) => u.id === googleUserId);
    if (!user) {
      // If user does not exist, add to the users array
      user = {
        id: googleUserId,
        displayName: req.user.displayName,
        email: req.user.emails[0].value,
        photo: req.user.photos[0].value,
      };
      users.push(user);
      writeUsers(users);
    }

    // Successful authentication, redirect home.
    res.redirect(process.env.URL_PATH + "/");
  }
);

router.get(
  "/auth/github",
  passport.authenticate("github", { scope: ["user:email"] })
);

router.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/" }),
  (req, res) => {
    const users = readUsers();
    const githubUserId = req.user.id; // Assuming `req.user` contains the authenticated user's info
    // Check if user already exists
    let user = users.find((u) => u.id === githubUserId);
    if (!user) {
      // If user does not exist, add to the users array
      user = {
        id: githubUserId,
        displayName: req.user.displayName,
        email: req.user.profileUrl,
        photo: req.user.photos[0].value,
      };
      users.push(user);
      writeUsers(users);
    }

    // Successful authentication, redirect home.
    res.redirect(process.env.URL_PATH + "/");
  }
);

// Serve static files from the 'protected' folder
router.use(
  "/",
  isAuthenticated,
  express.static(path.join(__dirname, "protected"))
);

// Load data from JSON files
const playersFilePath = path.join(__dirname, "data/players.json");
const scoresFilePath = path.join(__dirname, "data/scores.json");
const usersFilePath = path.join(__dirname, "data/users.json");
const gamesFilePath = path.join(__dirname, "data/games.json");
const sharedFilePath = path.join(__dirname, "data/shared.json");

const readPlayers = (id) => {
  const data = fs.readFileSync(playersFilePath, "utf8");
  const players = JSON.parse(data);

  // If id is provided, filter and return the matching player
  if (id !== undefined) {
    return players.filter((player) => player.user_id === id);
  }

  // If no id is provided, return all players
  return players;
};

const writePlayers = (players) => {
  fs.writeFileSync(playersFilePath, JSON.stringify(players, null, 2), "utf8");
};

const readScores = () => {
  const data = fs.readFileSync(scoresFilePath, "utf8");
  return JSON.parse(data);
};

const writeScores = (scores) => {
  fs.writeFileSync(scoresFilePath, JSON.stringify(scores, null, 2), "utf8");
};

const readGames = (id) => {
  const data = fs.readFileSync(gamesFilePath, "utf8");
  const games = JSON.parse(data);

  // If id is provided, filter and return the matching player
  if (id !== undefined) {
    return games.filter((user) => user.user_id === id);
  }

  // If no id is provided, return all players
  return games;
};

const writeGames = (games) => {
  fs.writeFileSync(gamesFilePath, JSON.stringify(games, null, 2), "utf8");
};

const readUsers = () => {
  if (fs.existsSync(usersFilePath)) {
    const data = fs.readFileSync(usersFilePath, "utf8");
    return JSON.parse(data);
  } else {
    return [];
  }
};

const writeUsers = (users) => {
  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), "utf8");
};

const readShared = (shareId) => {
  const data = fs.readFileSync(sharedFilePath, "utf8");
  const shares = JSON.parse(data);

  // If id is provided, filter and return the matching player
  if (shareId !== undefined) {
    return shares.filter((share) => share.code == shareId);
  }

  // If no id is provided, return all players
  return shares;
};

const writeShared = (shares) => {
  fs.writeFileSync(sharedFilePath, JSON.stringify(shares, null, 2), "utf8");
};

// Define a GET endpoint that returns all players
router.get("/api/players", isAuthenticated, (req, res) => {
  const players = readPlayers(req.user.id);
  res.json(players);
});

router.get("/api/player/:playerId", isAuthenticated, (req, res) => {
  let playerId = parseInt(req.params.playerId);
  const players = readPlayers(req.user.id);
  let player = players.find((s) => s.id === playerId);
  res.json(player);
});

router.delete("/api/player/:playerId", isAuthenticated, (req, res) => {
  const playerId = parseInt(req.params.playerId);
  let players = readPlayers();
  let scores = readScores(); // Read scores data

  // Find the index of the player to delete
  const playerIndex = players.findIndex((player) => player.id === playerId);

  if (playerIndex !== -1) {
    // Remove the player from the array
    const deletedPlayer = players.splice(playerIndex, 1)[0]; // Splice returns an array, so we take the first (and only) element
    writePlayers(players);

    // Remove the player's scores from the scores array
    scores = scores.filter((score) => score.playerId !== playerId);
    writeScores(scores);

    res.json({ message: "Player deleted successfully", deletedPlayer });
  } else {
    res.status(404).json({ error: "Player not found" });
  }
});

// Define a POST endpoint to add a new player
router.post("/api/players", isAuthenticated, (req, res) => {
  const players = readPlayers();
  const scores = readScores(); // Read scores data
  const newPlayerId = players.length ? players[players.length - 1].id + 1 : 1;
  const newPlayer = {
    id: newPlayerId,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    username: req.body.username,
    user_id: req.user.id,
  };

  // Add new player to players.json
  players.push(newPlayer);
  writePlayers(players);

  // Add new player to scores.json with an empty array of scores
  const newPlayerScoresEntry = {
    playerId: newPlayerId,
    scores: [],
  };
  scores.push(newPlayerScoresEntry);
  writeScores(scores);

  res.json(newPlayer);
});

router.get("/api/games", isAuthenticated, (req, res) => {
  const games = readGames(req.user.id);
  res.json(games);
});

router.post("/api/games", isAuthenticated, (req, res) => {
  const userId = req.user.id;
  const games = readGames();
  const newGameId = games.length ? games[games.length - 1].id + 1 : 1;
  const newGame = {
    id: newGameId,
    game: req.body.game,
    user_id: userId,
  };

  games.push(newGame);
  writeGames(games);

  res.json(newGame);
});

// Define a GET endpoint that returns scores for a specific player
router.get("/api/scores/:playerId", isAuthenticated, (req, res) => {
  const scores = readScores();
  const playerId = parseInt(req.params.playerId, 10);
  const playerScores = scores.find((s) => s.playerId === playerId);
  if (playerScores) {
    res.json(playerScores);
  } else {
    res.status(404).json({ error: "Player not found" });
  }
});

// Define a POST endpoint to add a new score for a specific player
router.post("/api/scores/:playerId", isAuthenticated, (req, res) => {
  const scores = readScores();
  const playerId = parseInt(req.params.playerId);
  const playerScores = scores.find((s) => s.playerId === playerId);

  if (playerScores) {
    const newScore = {
      scoreId: playerScores.scores.length
        ? playerScores.scores[playerScores.scores.length - 1].scoreId + 1
        : 1,
      value: parseInt(req.body.value),
      game: parseInt(req.body.game),
      date: new Date().toISOString(),
    };
    playerScores.scores.push(newScore);
  } else {
    const newScoreEntry = {
      playerId: playerId,
      scores: [
        {
          scoreId: 1,
          value: req.body.value,
          game: parseInt(req.body.game),
          date: new Date().toISOString(),
        },
      ],
    };
    scores.push(newScoreEntry);
  }

  writeScores(scores);
  res.json({ message: "Score added successfully" });
});

// Define a GET endpoint that calculates and returns the player's skill level
router.get("/api/skill/:playerId/:gameId", isAuthenticated, (req, res) => {
  const scores = readScores();
  const playerId = parseInt(req.params.playerId, 10);
  const gameId = parseInt(req.params.gameId, 10);
  const playerScores = scores.find((s) => s.playerId === playerId);

  if (gameId !== 0) {
    playerScores.scores = playerScores.scores.filter((s) => s.game === gameId);

    if (playerScores) {
      const scoresWithDates = playerScores.scores.map((score) => ({
        ...score,
        date: new Date(score.date),
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
  } else {
    const games = readGames(req.user.id);
    const players = readPlayers(req.user.id);

    players.forEach((p) => {
      p.points = 0;
    });

    for (let i = 0; i < games.length; i++) {
      let game = games[i].id;

      let tempPlayers = [];

      for (let j = 0; j < players.length; j++) {
        let player = players[j].id;

        const scores = readScores();
        const playerId = player;
        const gameId = game;
        const playerScores = scores.find((s) => s.playerId === playerId);

        playerScores.scores = playerScores.scores.filter(
          (s) => s.game === gameId
        );

        if (playerScores) {
          const scoresWithDates = playerScores.scores.map((score) => ({
            ...score,
            date: new Date(score.date),
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

          const weightedAverage =
            totalWeight > 0 ? weightedSum / totalWeight : 0; // If totalWeight is 0, set skill level to 0

          players[j].skill = weightedAverage;
          tempPlayers.push(players[j]);
        } else {
          // If player has no scores, return skill level of 0
          players[j].skill = 0;
          tempPlayers.push(players[j]);
        }
      }
      tempPlayers = tempPlayers.filter((p) => p.skill !== 0);
      tempPlayers.sort((a, b) => b.skill - a.skill);

      for (let k = 0; k < tempPlayers.length; k++) {
        let points = tempPlayers.length - k;
        let id = tempPlayers[k].id;

        players.find((p) => {
          if (p.id === id) {
            p.points = p.points + points; // Add points to the existing value
          }
        });
      }
    }

    players.sort((a, b) => b.points - a.points);

    players.forEach((p) => {
      if (p.id === playerId) {
        p.skillLevel = p.points;
      }
    });

    res.json(players.find((p) => p.id === playerId));
  }
});

// Endpoint to change username
router.put("/api/players", isAuthenticated, (req, res) => {
  const { existingUsername, newUsername } = req.body;
  const players = readPlayers();
  const player = players.find((player) => player.username === existingUsername);

  if (!player) {
    return res.status(404).json({ error: "Player not found" });
  }

  // Update the username
  player.username = newUsername;
  writePlayers(players);
  res.json({ message: "Username changed successfully", player });
});

router.get("/profile", isAuthenticated, (req, res) => {
  // Access the authenticated user's information
  const user = req.user;
  res.json({
    id: user.id,
    displayName: user.displayName,
    email: user.emails ? user.emails[0].value : user.profileUrl,
    photos: user.photos,
  });
});

router.get("/api/leaderboard", isAuthenticated, (req, res) => {
  const games = readGames(req.user.id);
  const players = readPlayers(req.user.id);

  players.forEach((p) => {
    p.points = 0;
  });

  for (let i = 0; i < games.length; i++) {
    let game = games[i].id;

    let tempPlayers = [];

    for (let j = 0; j < players.length; j++) {
      let player = players[j].id;

      const scores = readScores();
      const playerId = player;
      const gameId = game;
      const playerScores = scores.find((s) => s.playerId === playerId);

      playerScores.scores = playerScores.scores.filter(
        (s) => s.game === gameId
      );

      if (playerScores) {
        const scoresWithDates = playerScores.scores.map((score) => ({
          ...score,
          date: new Date(score.date),
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

        players[j].skill = weightedAverage;
        tempPlayers.push(players[j]);
      } else {
        // If player has no scores, return skill level of 0
        players[j].skill = 0;
        tempPlayers.push(players[j]);
      }
    }
    tempPlayers = tempPlayers.filter((p) => p.skill !== 0);
    tempPlayers.sort((a, b) => b.skill - a.skill);

    for (let k = 0; k < tempPlayers.length; k++) {
      let points =
        tempPlayers.length - k + (players.length - tempPlayers.length);
      let id = tempPlayers[k].id;

      players.find((p) => {
        if (p.id === id) {
          p.points = p.points + points; // Add points to the existing value
        }
      });
    }
  }

  players.sort((a, b) => b.points - a.points);

  res.json(players);
});

// Logout route
router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.clearCookie("connect.sid"); // Assuming you are using the default cookie name
      res.json({ path: process.env.URL_PATH + "/" }); // Redirect to the homepage or login page
    });
  });
});

router.post("/api/teamImage", isAuthenticated, (req, res) => {
  const teams = req.body.teams;
  nodeHtmlToImage({
    output: `teamImage-${req.user.id}.png`,
    html: `<html>
            <head>
              <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
        integrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN" crossorigin="anonymous">
            </head>
            <body>
              <table class="table table-striped" style="table-layout: auto; width: auto; font-family: var(--bs-body-font-family);">${teams}</table>
            </body>
          </html>`,
    selector: "table",
    encoding: "base64",
    transparent: true,
    puppeteer: puppeteerCore,
    puppeteerArgs: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
    },
  }).then((image) => {
    res.json({
      image: image,
    });
  });
});

function generateRandomString(length) {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    result += charset[randomIndex];
  }

  return result;
}

router.post("/api/share", isAuthenticated, (req, res) => {
  let user = req.user.id;
  let code = generateRandomString(6);

  let shares = readShared();

  if (shares.filter((s) => s.user_id === user).length === 0) {
    shares.push({
      user_id: user,
      code: code,
    });

    writeShared(shares);

    res.json({
      code: code,
    });
  } else {
    res.json({
      error: "Already Shared",
    });
  }
});

router.get("/api/share", isAuthenticated, (req, res) => {
  let user = req.user.id;

  let shareCodes = readShared();

  let result = shareCodes.filter((s) => s.user_id === user);

  if (result.length === 0) {
    res.json({
      exists: false,
      code: "",
    });
  } else {
    res.json({
      exists: true,
      code: shareCodes[0].code,
    });
  }
});

router.delete("/api/share", isAuthenticated, (req, res) => {
  let user = req.user.id;

  let shareCodes = readShared();

  let result = shareCodes.filter((s) => s.user_id !== user);

  writeShared(result);

  res.json({
    success: true,
  });
});

app.use(process.env.URL_PATH, router);

// Start the server
app.listen(port, () => {
  console.log(
    `Server is running on http://localhost:${port}${process.env.URL_PATH}`
  );
});
