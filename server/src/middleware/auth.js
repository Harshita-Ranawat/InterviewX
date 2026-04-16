import { verifyFirebaseToken } from "../config/firebaseAdmin.js";
import { User } from "../models/User.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: "Missing bearer token" });
    }
    let decoded;
    try {
      decoded = await verifyFirebaseToken(token);
    } catch (e) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const email = (decoded.email || "").toLowerCase();

    let user = await User.findOne({ firebaseUid: decoded.uid });
    if (!user) {
      user = await User.create({
        firebaseUid: decoded.uid,
        email: email || "unknown@local",
        displayName: decoded.name || "",
        photoURL: decoded.picture || "",
        role: "user",
        lastLoginAt: new Date(),
      });
    } else {
      user.email = email || user.email;
      user.displayName = decoded.name || user.displayName;
      user.photoURL = decoded.picture || user.photoURL;
      user.role = "user";
      user.lastLoginAt = new Date();
      await user.save();
    }

    req.user = user;
    req.firebaseDecoded = decoded;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Auth failed" });
  }
}
