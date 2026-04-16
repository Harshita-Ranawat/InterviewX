/**
 * Socket.io namespace /webrtc — relays SDP + ICE between peers in a room (mesh signaling).
 * Clients use Firebase uid as stable userId for routing.
 */
export function registerWebRtcRoom(io) {
  const nsp = io.of("/webrtc");
  /** roomId -> Map<userId, socketId> */
  const roomUsers = new Map();

  function getRoomMap(roomId) {
    if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
    return roomUsers.get(roomId);
  }

  nsp.on("connection", (socket) => {
    socket.on("webrtc-join", ({ roomId, userId }) => {
      if (!roomId || !userId) return;
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userId = userId;
      const m = getRoomMap(roomId);
      const existing = [...m.keys()];
      m.set(userId, socket.id);
      socket.to(roomId).emit("webrtc-peer-joined", { userId });
      socket.emit("webrtc-roster", { peers: existing });
    });

    socket.on("webrtc-signal", ({ roomId, targetUserId, payload }) => {
      if (!roomId || !targetUserId || !payload) return;
      const m = getRoomMap(roomId);
      const targetSocketId = m.get(targetUserId);
      if (!targetSocketId) return;
      nsp.to(targetSocketId).emit("webrtc-signal", {
        fromUserId: socket.data.userId,
        payload,
      });
    });

    /** Host ends the meeting for all participants (they may start a new visit by opening the room again). */
    socket.on("webrtc-host-end", ({ roomId }) => {
      if (!roomId) return;
      socket.to(roomId).emit("webrtc-room-ended", { reason: "host" });
    });

    socket.on("disconnect", () => {
      const roomId = socket.data.roomId;
      const userId = socket.data.userId;
      if (!roomId || !userId) return;
      const m = getRoomMap(roomId);
      m.delete(userId);
      socket.to(roomId).emit("webrtc-peer-left", { userId });
      if (m.size === 0) roomUsers.delete(roomId);
    });
  });
}
