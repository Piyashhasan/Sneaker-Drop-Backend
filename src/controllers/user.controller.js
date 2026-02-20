import { User } from "../models/index.js";

// -- USER CREATE --
export const registerUser = async (req, res) => {
  const { username } = req.body;

  if (!username || username.trim().length < 2) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid username" });
  }

  try {
    const [user, created] = await User.findOrCreate({
      where: { username: username.trim() },
      defaults: { username: username.trim() },
    });

    return res
      .status(created ? 201 : 200)
      .json({ success: true, data: { id: user.id, username: user.username } });
  } catch (err) {
    console.error("registerUser error:", err);
    res
      .status(500)
      .json({ success: false, message: "Could not register user" });
  }
};
