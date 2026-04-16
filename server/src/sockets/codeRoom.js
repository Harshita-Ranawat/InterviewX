export function registerCodeRoom(io) {
  const codeNs = io.of("/code");

  codeNs.on("connection", (socket) => {
    socket.on("join-room", ({ roomId, userId, displayName }) => {
      if (!roomId) return;
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userId = userId;
      socket.to(roomId).emit("peer-joined", { userId, displayName });
    });

    socket.on("code-update", ({ roomId, code, language }) => {
      if (!roomId) return;
      socket.to(roomId).emit("code-remote", { code, language, from: socket.data.userId });
    });

    socket.on("cursor", (payload) => {
      const roomId = payload?.roomId || socket.data.roomId;
      if (!roomId) return;
      socket.to(roomId).emit("cursor-remote", payload);
    });

    /** Per-question timer — host (or any participant) broadcasts authoritative state */
    socket.on("question-timer-sync", ({ roomId, state }) => {
      if (!roomId || !state) return;
      socket.to(roomId).emit("question-timer-sync", state);
    });

    socket.on("disconnecting", () => {
      const roomId = socket.data.roomId;
      if (roomId) {
        socket.to(roomId).emit("peer-left", { userId: socket.data.userId });
      }
    });
  });
}
