// Load environment variables
require("dotenv").config();

const express = require("express");
const path = require("path");
const http = require("http");
const socketio = require("socket.io");
const Filter = require("bad-words");

const { generateMessage } = require("./utils/messages");
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require("./utils/user");

// Initialize express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize socket.io with proper CORS for production
const io = socketio(server, {
  cors: {
    origin: "*", // For production, you can replace "*" with your frontend URL
    methods: ["GET", "POST"],
  },
});

// Define port (Render will inject PORT automatically)
const port = process.env.PORT || 3000;

// Serve static files
const publicDirectoryPath = path.join(__dirname, "../public");
app.use(express.static(publicDirectoryPath));

// Socket connection
io.on("connection", (socket) => {
  console.log("New WebSocket connection");

  // Join room
  socket.on("join", ({ username, room }, callback) => {
    const { error, user } = addUser({
      id: socket.id,
      username,
      room,
    });

    if (error) {
      return callback(error);
    }

    socket.join(user.room);

    // Welcome message
    socket.emit("message", generateMessage("Admin", "Welcome!"));

    // Broadcast to others
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        generateMessage("Admin", `${user.username} has joined`)
      );

    // Send room data
    io.to(user.room).emit("roomData", {
      room: user.room,
      users: getUsersInRoom(user.room),
    });

    callback();
  });

  // Send message
  socket.on("sendMessage", (message, callback) => {
    const filter = new Filter();
    const user = getUser(socket.id);

    if (!user) {
      return callback("User not found");
    }

    if (filter.isProfane(message)) {
      return callback("Profanity is not allowed!");
    }

    io.to(user.room).emit(
      "message",
      generateMessage(user.username, message)
    );

    callback();
  });

  // Disconnect
  socket.on("disconnect", () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit(
        "message",
        generateMessage("Admin", `${user.username} has left`)
      );

      io.to(user.room).emit("roomData", {
        room: user.room,
        users: getUsersInRoom(user.room),
      });
    }
  });
});

// Start server
server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});