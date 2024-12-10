require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
const port = process.env.PORT;

app.use(cors({ origin: "*" }));
app.use(express.json());

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

function connectDatabase() {
  db.connect((err) => {
    if (err) {
      console.error(
        "Database connection failed, retrying in 5 seconds...",
        err.stack
      );
      setTimeout(connectDatabase, 5000);
    } else {
      console.log("Connected to database.");
    }
  });
}

connectDatabase();

// Register or log in a user
app.post("/login", (req, res) => {
  const { firebaseUid, email } = req.body;

  if (!firebaseUid || !email) {
    return res.status(400).json({ error: "Missing firebaseUid or email" });
  }

  const checkUserSql = "SELECT id, username FROM users WHERE firebase_uid = ?";
  db.query(checkUserSql, [firebaseUid], (err, results) => {
    if (err) return res.status(500).json({ error: "Database query failed" });

    if (results.length > 0) {
      return res.json(results[0]);
    } else {
      const username = email.split("@")[0];
      const registerUserSql =
        "INSERT INTO users (firebase_uid, email, username) VALUES (?, ?, ?)";
      db.query(
        registerUserSql,
        [firebaseUid, email, username],
        (err, results) => {
          if (err)
            return res.status(500).json({ error: "Failed to register user" });
          res.json({ id: results.insertId, username });
        }
      );
    }
  });
});

// Get events for a user
app.get("/events", (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  const sql = `
    SELECT 
      id,
      user_id,
      title,
      DATE_FORMAT(date, '%Y-%m-%d') as date,
      TIME_FORMAT(time, '%H:%i') as time,
      description,
      link
    FROM events 
    WHERE user_id = ?
    ORDER BY date ASC, time ASC`;

  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: "Database query failed" });
    res.json(results);
  });
});

// Create a new event
app.post("/events", (req, res) => {
  const { userId, title, date, time, description, link } = req.body;

  if (!userId || !title || !date || !time) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const sql = `
    INSERT INTO events 
    (user_id, title, date, time, description, link) 
    VALUES (?, ?, ?, ?, ?, ?)`;

  db.query(
    sql,
    [userId, title, date, time, description, link],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Failed to create event" });
      res.json({ id: results.insertId, message: "Event created successfully" });
    }
  );
});

// Update an event
app.put("/events/:id", (req, res) => {
  const eventId = req.params.id;
  const { title, date, time, description, link } = req.body;

  if (!title || !date || !time) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const sql = `
    UPDATE events 
    SET 
      title = ?,
      date = ?,
      time = ?,
      description = ?,
      link = ?
    WHERE id = ?`;

  db.query(
    sql,
    [title, date, time, description, link, eventId],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Failed to update event" });

      if (results.affectedRows === 0) {
        return res.status(404).json({ error: "Event not found" });
      }

      res.json({ message: "Event updated successfully", eventId });
    }
  );
});

// Delete an event
app.delete("/events/:id", (req, res) => {
  const eventId = req.params.id;

  const sql = "DELETE FROM events WHERE id = ?";
  db.query(sql, [eventId], (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to delete event" });

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json({ message: "Event deleted successfully", eventId });
  });
});

// Get a specific event
app.get("/events/:id", (req, res) => {
  const eventId = req.params.id;

  const sql = `
    SELECT 
      id,
      user_id,
      title,
      DATE_FORMAT(date, '%Y-%m-%d') as date,
      TIME_FORMAT(time, '%H:%i') as time,
      description,
      link
    FROM events 
    WHERE id = ?`;

  db.query(sql, [eventId], (err, results) => {
    if (err) return res.status(500).json({ error: "Database query failed" });

    if (results.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json(results[0]);
  });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log("Closing database connection...");
  db.end((err) => {
    if (err) console.error("Error closing database:", err);
    console.log("Database connection closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
