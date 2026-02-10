import { Server } from "socket.io";
import { createServer } from "http";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

interface AuthenticatedSocket {
  userId: string;
  userName: string;
}

const authenticatedSockets = new Map<string, AuthenticatedSocket>();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Handle authentication
  socket.on("auth", (data: { userId: string; userName: string }) => {
    authenticatedSockets.set(socket.id, {
      userId: data.userId,
      userName: data.userName,
    });

    // Join user's personal room
    socket.join(`user:${data.userId}`);
    console.log(`User ${data.userName} authenticated`);
  });

  // Handle joining order rooms
  socket.on("join:order", (orderId: string) => {
    const auth = authenticatedSockets.get(socket.id);
    if (!auth) {
      socket.emit("error", { message: "Not authenticated" });
      return;
    }

    socket.join(`order:${orderId}`);
    console.log(`User ${auth.userName} joined order room: ${orderId}`);
  });

  // Handle leaving order rooms
  socket.on("leave:order", (orderId: string) => {
    socket.leave(`order:${orderId}`);
  });

  // Handle typing indicators
  socket.on("typing:start", (data: { orderId: string }) => {
    const auth = authenticatedSockets.get(socket.id);
    if (!auth) return;

    socket.to(`order:${data.orderId}`).emit("typing:update", {
      userId: auth.userId,
      userName: auth.userName,
      isTyping: true,
    });
  });

  socket.on("typing:stop", (data: { orderId: string }) => {
    const auth = authenticatedSockets.get(socket.id);
    if (!auth) return;

    socket.to(`order:${data.orderId}`).emit("typing:update", {
      userId: auth.userId,
      userName: auth.userName,
      isTyping: false,
    });
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    authenticatedSockets.delete(socket.id);
    console.log("Client disconnected:", socket.id);
  });
});

// Helper functions to emit events from the API
export function emitNewMessage(orderId: string, message: unknown) {
  io.to(`order:${orderId}`).emit("message:new", message);
}

export function emitOrderUpdated(orderId: string, update: unknown) {
  io.to(`order:${orderId}`).emit("order:updated", update);
}

export function emitToUser(userId: string, event: string, data: unknown) {
  io.to(`user:${userId}`).emit(event, data);
}

const PORT = parseInt(process.env.SOCKET_PORT || "3001", 10);

httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});

export { io };
